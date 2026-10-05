import json, os, re, sys, urllib.request

BASE = 'https://bpcdn.atkgear.com/hub-v3/production/'
CACHE = os.environ.get('HUBWATCH_CACHE', '.hubwatch')
CATS = ('monitorID', 'tabletID', 'webcamID', 'microphoneID', 'handheldID', 'speakerID', 'dockID', 'glassesID', 'mouseCidMid')
ENTRY = re.compile(r'\{vendorId:(\d+),productId:(\d+),usagePage:(\d+),usage:\d+,(?:receiver:!0,)?custom:\{(?:\.\.\.\w+,)?(?:name|title):"([^"]*)"([^{}]{0,300})')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')


def bundle(ver):
    d = os.path.join(CACHE, ver)
    os.makedirs(d, exist_ok=True)
    seen, todo, out = set(), ['index.html'], []
    while todo:
        f = todo.pop()
        if f in seen:
            continue
        seen.add(f)
        p = os.path.join(d, f.replace('/', '_'))
        if os.path.exists(p):
            s = open(p, encoding='utf-8').read()
        else:
            try:
                s = get(BASE + ver + '/' + f)
            except Exception:
                continue
            open(p, 'w', encoding='utf-8').write(s)
        out.append(s)
        todo += [x for x in re.findall(r'static/[A-Za-z0-9_.-]+\.js', s) if x not in seen]
    return '\n'.join(out)


def scan(ver):
    s = bundle(ver)
    devs = {}
    for vid, pid, up, name, rest in ENTRY.findall(s):
        cat = next((c for c in CATS if c + ':' in rest), '')
        devs['%x:%04x' % (int(vid), int(pid))] = {'name': name, 'usagePage': '%x' % int(up), 'cat': cat}
    return devs


def main(argv):
    if len(argv) == 2:
        print(json.dumps(scan(argv[1]), indent=1))
        return
    if len(argv) != 3:
        print('usage: hubwatch.py <version> | hubwatch.py <old> <new>')
        sys.exit(2)
    a, b = scan(argv[1]), scan(argv[2])
    added, removed = sorted(set(b) - set(a)), sorted(set(a) - set(b))
    print('%s: %d devices, %s: %d devices' % (argv[1], len(a), argv[2], len(b)))
    for k in added:
        print('+ %s %s [%s] %s' % (k, b[k]['name'], b[k]['usagePage'], b[k]['cat']))
    for k in removed:
        print('- %s %s' % (k, a[k]['name']))
    renamed = [k for k in set(a) & set(b) if a[k]['name'] != b[k]['name']]
    for k in sorted(renamed):
        print('~ %s %s -> %s' % (k, a[k]['name'], b[k]['name']))


if __name__ == '__main__':
    main(sys.argv)
