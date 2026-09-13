"""Remove Python comments and docstrings using the real tokenizer and AST.

Regexes cannot do this correctly: "#" appears inside strings, and docstrings are
expressions, not comments. tokenize gives exact COMMENT spans; ast gives exact
docstring spans. Both are the interpreter's own view of the source.
"""
import ast, io, sys, tokenize

# 한컴 수식 규격서의 저작권 조항이 소스에 이 문장을 요구한다. 설명을 지우는 것과
# 법적 고지를 지우는 것은 다르다 — 고지는 남기되 주변 해설은 함께 남기지 않는다.
NOTICE = "본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."
KEEP = ("Copyright", "SPDX", "@license")


def required_notice(text):
    return "한글과컴퓨터" in text


def spans_to_drop(src, keep_module_doc):
    drop = []
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type != tokenize.COMMENT or any(k in tok.string for k in KEEP):
            continue
        drop.append((tok.start, tok.end, "# " + NOTICE if required_notice(tok.string) else ""))
    tree = ast.parse(src)
    holders = (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
    for node in ast.walk(tree):
        if not isinstance(node, holders):
            continue
        if isinstance(node, ast.Module) and keep_module_doc:
            # 도움말로 인쇄되는 docstring 은 남기되 개발 근거는 뺀다.
            doc = node.body[0] if node.body and isinstance(node.body[0], ast.Expr) else None
            if doc and isinstance(getattr(doc, "value", None), ast.Constant) \
                    and isinstance(doc.value.value, str) and "⚠️" in doc.value.value:
                kept = doc.value.value.split("⚠️")[0].rstrip() + "\n"
                drop.append(((doc.lineno, doc.col_offset), (doc.end_lineno, doc.end_col_offset),
                             '"""' + kept + '"""'))
            continue
        if not (node.body and isinstance(node.body[0], ast.Expr)
                and isinstance(node.body[0].value, ast.Constant)
                and isinstance(node.body[0].value.value, str)):
            continue
        doc = node.body[0]
        if any(k in doc.value.value for k in KEEP):
            continue
        if required_notice(doc.value.value):
            drop.append(((doc.lineno, doc.col_offset), (doc.end_lineno, doc.end_col_offset),
                         '"""' + NOTICE + '"""'))
            continue
        # A function whose only statement is its docstring needs a replacement statement.
        filler = "pass" if len(node.body) == 1 and not isinstance(node, ast.Module) else ""
        drop.append(((doc.lineno, doc.col_offset), (doc.end_lineno, doc.end_col_offset), filler))
    return drop


def apply(src, drop):
    lines = src.splitlines(keepends=True)
    for (sl, sc), (el, ec), filler in sorted(drop, reverse=True):
        head = lines[sl - 1][:sc]
        tail = lines[el - 1][ec:]
        replacement = head + filler + tail
        blank_line = filler == "" and not head.strip() and not tail.strip()
        lines[sl - 1:el] = [] if blank_line else [replacement]
    return "".join(lines)


def collapse(text):
    out, blanks = [], 0
    for line in text.splitlines():
        stripped = line.rstrip()
        blanks = blanks + 1 if not stripped else 0
        if blanks > 2:
            continue
        out.append(stripped)
    return "\n".join(out).strip("\n") + "\n"


def strip(src, keep_module_doc=False):
    return collapse(apply(src, spans_to_drop(src, keep_module_doc)))


if __name__ == "__main__":
    source = sys.stdin.read()
    result = strip(source, keep_module_doc="--keep-module-doc" in sys.argv)
    compile(result, "<stripped>", "exec")  # never emit source the interpreter rejects
    sys.stdout.write(result)
