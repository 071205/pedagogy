"""Validate the parsed TOML that Wrangler will use for the local asset fixture."""

import sys
try:
    import tomllib
except ModuleNotFoundError:
    print("static staging config requires Python 3.11+ tomllib", file=sys.stderr)
    sys.exit(1)


def check(config_text: str) -> None:
    config = tomllib.loads(config_text)
    if set(config) != {"name", "compatibility_date", "assets"}:
        raise ValueError("static staging config has unexpected top-level keys")
    if config["name"] != "pedagogy-static-local-fixture":
        raise ValueError("static staging config has an unexpected name")
    if config["compatibility_date"] != "2026-10-19":
        raise ValueError("static staging config has an unexpected compatibility date")
    assets = config["assets"]
    if not isinstance(assets, dict) or set(assets) != {
        "directory", "html_handling", "not_found_handling"
    }:
        raise ValueError("static staging config has unexpected assets keys")
    if assets["directory"] != "./dist/public":
        raise ValueError("static staging config assets.directory must be ./dist/public")
    if assets["html_handling"] != "auto-trailing-slash":
        raise ValueError("static staging config has unsafe html_handling")
    if assets["not_found_handling"] != "none":
        raise ValueError("static staging config has unsafe not_found_handling")


try:
    check(sys.stdin.read())
except (tomllib.TOMLDecodeError, ValueError, TypeError, KeyError) as error:
    print(f"static staging config rejected: {error}", file=sys.stderr)
    sys.exit(1)
