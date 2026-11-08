import concurrent.futures as cf
import json, os, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hubwatch import bundle

API = 'https://api-hub-cloud.atk.pro/firmware/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV = re.compile(r'vendorId:(\d+),productId:(\d+)')


def devices(s):
    out = {}
    for m in DEV.finditer(s):
        chunk = s[m.end():m.end() + 700].split('vendorId:')[0]
        e = out.setdefault((int(m.group(1)), int(m.group(2))), (set(), set()))
        e[0].update(re.findall(r'(?:name|title):"([^"]+)"', chunk)[:1])
        e[1].update(re.findall(r'firmwareMark:"([^"]+)"', chunk)[:1])
    return out


def get(path):
    for a in range(3):
        try:
            req = urllib.request.Request(API + path, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read()).get('data')
        except Exception:
            time.sleep(2 * (a + 1))
    return None


def lookup(job):
    (vid, pid), names, mark = job
    time.sleep(0.15)
    items = get('%d/%d/%s/list' % (vid, pid, mark)) or [get('%d/%d/%s' % (vid, pid, mark))]
    return [{'name': ' / '.join(sorted(names)) or '?', 'vid': '%04x' % vid, 'pid': '%04x' % pid, 'mark': mark,
             'version': i.get('version'), 'file': i['file'],
             'notes': (i.get('content_en') or i.get('content') or '').strip()}
            for i in items if i and i.get('file')]


def main(argv):
    if len(argv) != 2:
        print('usage: fwdir.py <hub version>')
        sys.exit(2)
    jobs = [(k, names, m) for k, (names, marks) in devices(bundle(argv[1])).items()
            for m in marks | {'dongle'} | (set() if marks else {'device', 'mouse'})]
    with cf.ThreadPoolExecutor(4) as ex:
        rows = [r for out in ex.map(lookup, jobs) for r in out]
    rows = sorted({(r['file'], r['mark']): r for r in rows}.values(), key=lambda r: (r['name'].lower(), r['mark'], r['vid'], r['pid']))
    json.dump(rows, open(os.path.join(ROOT, 'docs', 'firmware.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    page = os.path.join(ROOT, 'firmware', 'index.html')
    html = open(page, encoding='utf-8').read()
    blob = json.dumps({'hub': argv[1], 'rows': rows}, ensure_ascii=False).replace('</', '<\\/')
    html = re.sub(r'(<script id="fw" type="application/json">).*?(</script>)', lambda m: m.group(1) + blob + m.group(2), html, count=1, flags=re.S)
    open(page, 'w', encoding='utf-8').write(html)
    print('%d rows' % len(rows))


assert devices('{vendorId:13652,productId:62863,usagePage:1,custom:{name:"VXE R1",firmwareMark:"r1"}},{vendorId:1,productId:2}') == {(13652, 62863): ({'VXE R1'}, {'r1'}), (1, 2): (set(), set())}

if __name__ == '__main__':
    main(sys.argv)
