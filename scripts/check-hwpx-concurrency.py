"""실제 build의 두 요청을 겹쳐 단독 결과와 비교한다. 네트워크/사용자 자료 없음."""
import sys, tempfile, threading, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
sys.path.insert(0, str(Path('experiments/hwp-export').resolve()))
import mock_to_hwpx as m

def data(marker, sect):
    return {'round':'Concurrency fixture','elective':'미적분','problems':[{
        'num':23 if sect=='선택' else 1,'sect':sect,'type':'choice','pts':3,
        'blocks':[{'type':'statement','data':{'text':marker}}]}]}
def where(p, marker):
    with zipfile.ZipFile(p) as z:
        return [n for n in z.namelist() if n.startswith('Contents/section')
                and marker in ''.join(ET.fromstring(z.read(n)).itertext())]
with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp); a=data('ELECTIVE_FIXTURE','선택'); b=data('COMMON_FIXTURE','공통')
    m.build(a,root/'single.hwpx')
    entered=threading.Event(); resume=threading.Event(); bstarted=threading.Event(); bdone=threading.Event()
    errors=[]; original=m.emit_problem
    def scheduled(doc,q,rep,**kw):
        if threading.current_thread().name=='A':
            entered.set()
            if not resume.wait(10): raise TimeoutError('fixture scheduling')
        return original(doc,q,rep,**kw)
    def run_a():
        try:m.build(a,root/'a.hwpx')
        except Exception as e:errors.append(repr(e))
    def run_b():
        bstarted.set()
        try:m.build(b,root/'b.hwpx')
        except Exception as e:errors.append(repr(e))
        finally:bdone.set()
    m.emit_problem=scheduled
    ta=threading.Thread(target=run_a,name='A');tb=threading.Thread(target=run_b,name='B')
    try:
        ta.start();assert entered.wait(5)
        tb.start();assert bstarted.wait(5)
        # 수정 전에는 B가 끝나 A의 구역을 오염시킨다. 수정 후에는 lock에서 대기한다.
        completed_while_a_paused=bdone.wait(0.5)
    finally:
        resume.set();ta.join(15)
        if tb.ident is not None:tb.join(15)
        m.emit_problem=original
    assert not ta.is_alive() and not tb.is_alive()
    assert not errors,errors
    actual=where(root/'a.hwpx','ELECTIVE_FIXTURE')
    expected=where(root/'single.hwpx','ELECTIVE_FIXTURE')
    assert actual==expected==['Contents/section1.xml'],(actual,expected)
    assert where(root/'b.hwpx','COMMON_FIXTURE')==['Contents/section0.xml']
    assert not completed_while_a_paused,'build must serialize while globals remain'
    # 예외로 끝난 뒤에도 잠금이 풀리고 다음 출력이 가능하다.
    def broken(*args,**kwargs):raise RuntimeError('fixture failure')
    m.emit_problem=broken
    try:
        try:m.build(a,root/'broken.hwpx')
        except RuntimeError:pass
        else:raise AssertionError('failure not injected')
    finally:m.emit_problem=original
    m.build(a,root/'retry.hwpx')
    assert where(root/'retry.hwpx','ELECTIVE_FIXTURE')==expected
    print('HWPX concurrency and exception recovery passed')
