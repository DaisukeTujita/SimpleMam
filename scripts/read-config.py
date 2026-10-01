"""PowerShell uses Python's standard TOML parser instead of maintaining a second parser."""

import json
import sys
from pathlib import Path

import tomllib

with Path(sys.argv[1]).open("rb") as stream:
    config = tomllib.load(stream)
# Only startup ports/path; never put database passwords into process arguments/output.
print(json.dumps(config["server"]))
