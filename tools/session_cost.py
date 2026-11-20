#!/usr/bin/env python3
"""Split one Claude Code session's cost by what the agent did.

Usage: python3 tools/session_cost.py SESSION.jsonl [--calls] [--top N] [--json OUT]

Reads a transcript from ~/.claude/projects/. For every model call it takes the
recorded usage (fresh input, cache read, cache write 5m/1h, output). Content
added after a call (its output plus the tool results it asked for) is written to
the cache once and then re-read by every later call until a context reset
(compaction). This tool charges that whole lifetime cost to the tool call that
brought the content in, so a big file read early in a session shows its true
price.

Prices are per million tokens. They reproduce Claude Code's own costUSD for the
sessions checked on 16 Nov 2026 (Opus 5.5: $11.49 recorded, $11.49 computed).
"""
import json, re, sys, collections, argparse

PRICE = {  # $ per token: in, out, cache read, write 5m, write 1h
    'claude-opus-5-5':   (4e-6, 20e-6, 0.2e-6, 5e-6, 8e-6),
    'claude-sonnet-5-5': (2e-6, 10e-6, 0.1e-6, 2.5e-6, 4e-6),
    'claude-haiku-5-5':  (0.1e-6, 0.5e-6, 0.01e-6, 0.125e-6, 0.2e-6),
}

def category(name, inp):
    """Name what a tool call was for, from its tool and input."""
    if name == 'Read':
        p = inp.get('file_path', '')
        if re.search(r'\.(png|jpe?g|webp|gif)$', p): return 'look: image read'
        if '/skills/' in p or 'SKILL.md' in p: return 'read: skill file ' + p.split('/skills/')[-1]
        return 'read: other file'
    if name in ('Write', 'Edit', 'MultiEdit', 'NotebookEdit'):
        p = inp.get('file_path', '')
        return f'write: {name} ' + (p.rsplit('/', 1)[-1] if p else '')
    if name == 'Bash':
        c = inp.get('command', '')
        for pat, lab in [
            (r'lesson_lint|_lint\.py', 'check: lint'),
            (r'check_lesson|check-?scene|check_board|browser_check|\bcheck\b.*\.(py|mjs)', 'check: browser/check script'),
            (r'shoot|screenshot|contact', 'look: render stills'),
            (r'build_lesson|build\.py|build_class|\bbuild\b', 'build'),
            (r'make_data|verify_data', 'data: make/verify'),
            (r'\bcat\b|\bsed -n|\bhead\b|\btail\b|\bgrep\b|\bls\b|\bfind\b|\brg\b', 'read: via shell'),
        ]:
            if re.search(pat, c): return lab
        return 'bash: other'
    if name.startswith('mcp__ccd_turn') or name in ('TodoWrite',): return 'harness: plan/wrap-up'
    if name in ('SendUserFile',): return 'harness: send file'
    if name == 'Skill': return 'read: skill load'
    if name in ('Agent', 'Task'): return 'subagent'
    return 'tool: ' + name

def load(path):
    calls, seen, results = [], {}, {}
    for line in open(path):
        d = json.loads(line)
        t = d.get('type')
        if t == 'assistant':
            m = d['message']; mid = m.get('id')
            if mid not in seen:
                seen[mid] = len(calls)
                calls.append({'id': mid, 'model': m.get('model'), 'u': m.get('usage', {}),
                              'ts': d.get('timestamp'), 'tools': [], 'compact_before': False})
            c = calls[seen[mid]]
            for b in m.get('content', []) if isinstance(m.get('content'), list) else []:
                if b.get('type') == 'tool_use':
                    c['tools'].append({'id': b['id'], 'name': b['name'], 'input': b.get('input', {})})
        elif t == 'user':
            m = d.get('message', {})
            if d.get('isCompactSummary'):
                if calls: calls[-1]['compact_after'] = True
            cont = m.get('content')
            if isinstance(cont, list):
                for b in cont:
                    if b.get('type') == 'tool_result':
                        sz, img = 0, 0
                        bc = b.get('content')
                        if isinstance(bc, str): sz = len(bc)
                        elif isinstance(bc, list):
                            for x in bc:
                                if x.get('type') == 'text': sz += len(x.get('text', ''))
                                elif x.get('type') == 'image': img += 1
                        results[b['tool_use_id']] = (sz, img)
    calls = [c for c in calls if c['model'] and c['model'] in PRICE]
    return calls, results

def analyse(path):
    calls, results = load(path)
    n = len(calls)
    # segments split by context resets: a call whose cache read falls far below the previous context
    seg_end = [n] * n
    ends = []
    for i in range(1, n):
        prev = calls[i-1]['u']; cur = calls[i]['u']
        pctx = prev.get('cache_read_input_tokens', 0) + prev.get('cache_creation_input_tokens', 0)
        if calls[i-1].get('compact_after') or cur.get('cache_read_input_tokens', 0) < 0.5 * pctx - 20000:
            ends.append(i)
    ends.append(n)
    s = 0
    for e in ends:
        for i in range(s, e): seg_end[i] = e
        s = e
    rows, total = [], 0.0
    bycat = collections.defaultdict(lambda: [0, 0.0, 0, 0])  # calls, $, tokens, images
    for i, c in enumerate(calls):
        pin, pout, pcr, pw5, pw1 = PRICE[c['model']]
        u = c['u']
        cc = u.get('cache_creation', {}) or {}
        w5 = cc.get('ephemeral_5m_input_tokens', 0); w1 = cc.get('ephemeral_1h_input_tokens', 0)
        if not cc: w1 = u.get('cache_creation_input_tokens', 0)
        cost = (u.get('input_tokens', 0)*pin + u.get('output_tokens', 0)*pout +
                u.get('cache_read_input_tokens', 0)*pcr + w5*pw5 + w1*pw1)
        total += cost
        ctx = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
        # tokens this call's turn added = next call's cache write (same segment)
        added = 0
        if i + 1 < seg_end[i]:
            added = calls[i+1]['u'].get('cache_creation_input_tokens', 0)
        later = seg_end[i] - (i + 1)  # later calls that re-read it
        wprice = pw1 if w1 >= w5 else pw5
        life = added * (wprice + pcr * max(later - 1, 0)) + u.get('output_tokens', 0) * pout
        tools = c['tools'] or [{'id': None, 'name': '(text only)', 'input': {}}]
        share = life / len(tools)
        weights = []
        for t in tools:
            sz, img = results.get(t['id'], (0, 0))
            weights.append(sz + img * 6000 + 200)
        wsum = sum(weights)
        for t, w in zip(tools, weights):
            cat = category(t['name'], t['input']) if t['id'] else 'think/answer only'
            part = life * w / wsum
            sz, img = results.get(t['id'], (0, 0))
            bycat[cat][0] += 1; bycat[cat][1] += part; bycat[cat][2] += sz // 4; bycat[cat][3] += img
        rows.append({'i': i, 'ctx': ctx, 'out': u.get('output_tokens', 0), 'added': added, 'later': later,
                     'life': life, 'cost': cost,
                     'tools': [(t['name'], category(t['name'], t['input']) if t['id'] else '-',
                                (t['input'].get('file_path') or t['input'].get('command') or '')[:90],
                                results.get(t['id'], (0, 0))) for t in tools]})
    return rows, bycat, total, ends

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path'); ap.add_argument('--calls', action='store_true')
    ap.add_argument('--top', type=int, default=0); ap.add_argument('--json')
    a = ap.parse_args()
    rows, bycat, total, ends = analyse(a.path)
    tot_out = sum(r['out'] for r in rows)
    print(f'calls {len(rows)}  context resets at {ends[:-1]}  output {tot_out/1e3:.1f}k  cost ${total:.2f}')
    print(f'peak context {max(r["ctx"] for r in rows)/1e3:.0f}k  mean context {sum(r["ctx"] for r in rows)/len(rows)/1e3:.0f}k')
    print('\nlifetime cost by what the call did (output + cache write + later re-reads):')
    life_tot = sum(v[1] for v in bycat.values())
    for k, v in sorted(bycat.items(), key=lambda kv: -kv[1][1]):
        print(f'  {k:52s} {v[0]:4d} calls  ${v[1]:6.2f}  {100*v[1]/life_tot:4.1f}%  ~{v[2]/1e3:6.1f}k text tok  {v[3]} img')
    if a.top:
        print(f'\ntop {a.top} single calls by lifetime cost:')
        for r in sorted(rows, key=lambda r: -r['life'])[:a.top]:
            print(f"  #{r['i']:3d} ${r['life']:.2f} ctx {r['ctx']/1e3:.0f}k +{r['added']/1e3:.1f}k x{r['later']} later  out {r['out']}  " +
                  ' | '.join(f'{t[1]}: {t[2][:60]}' for t in r['tools']))
    if a.calls:
        for r in rows:
            print(f"#{r['i']:3d} ctx {r['ctx']/1e3:5.0f}k out {r['out']:5d} +{r['added']/1e3:5.1f}k ${r['life']:.2f}  " +
                  ' | '.join(f'{t[1]} {t[2][:70]} [{t[3][0]}c {t[3][1]}img]' for t in r['tools']))
    if a.json:
        json.dump({'rows': rows, 'bycat': bycat, 'total': total}, open(a.json, 'w'), default=str)

if __name__ == '__main__':
    main()
