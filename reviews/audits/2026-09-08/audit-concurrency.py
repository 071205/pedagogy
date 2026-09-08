import sys, tempfile, threading, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
sys.path.insert(0,str(Path('experiments/hwp-export').resolve()))
import mock_to_hwpx as m

def data(marker,sect):
    return {'round':marker,'elective':'미적분','problems':[{
        'num':23 if sect=='선택' else 1, 'sect':sect,'type':'choice','pts':3,
        'blocks':[{'type':'statement','data':{'text':marker}}]}]}
def where(path,marker):
    with zipfile.ZipFile(path) as z:
        return [n for n in z.namelist() if n.startswith('Contents/section')
                and marker in ''.join(ET.fromstring(z.read(n)).itertext())]
with tempfile.TemporaryDirectory() as outdir:
    root=Path(outdir)
    # The round title is separate from the unique problem sentinel.
    a=data('AUDIT_ELECTIVE_SENTINEL','선택');a['round']='Audit title'
    b=data('AUDIT_COMMON_SENTINEL','공통');b['round']='Audit title'
    m.build(a,root/'sequential.hwpx')
    entered=threading.Event();resume=threading.Event();errors=[]
    original=m.emit_problem
    def scheduled(doc,q,rep,**kw):
        if threading.current_thread().name=='A':
            entered.set()
            if not resume.wait(15):raise TimeoutError('audit scheduling timeout')
        return original(doc,q,rep,**kw)
    m.emit_problem=scheduled
    def run_a():
        try:m.build(a,root/'parallel.hwpx')
        except Exception as exc:errors.append(repr(exc))
    thread=threading.Thread(target=run_a,name='A');thread.start()
    try:
        assert entered.wait(10)
        m.build(b,root/'other.hwpx')
    finally:resume.set();thread.join(15);m.emit_problem=original
    print('CONCURRENT_EXPORT',{'errors':errors,'sequential':where(root/'sequential.hwpx','AUDIT_ELECTIVE_SENTINEL'),
         'interleaved':where(root/'parallel.hwpx','AUDIT_ELECTIVE_SENTINEL')})
