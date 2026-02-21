import re
import os

def harden_templates(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern: onclick="func('${arg}')"
    # Note: we need to handle both single and double quotes, and template literals
    
    # 1. onclick="func('${...}')" -> data-action="func" data-arg="${...}"
    new_content = re.sub(r'onclick="([a-zA-Z0-9_]+)\(\'(\${[^}]+})\'[^)]*\)"', r'data-action="\1" data-arg="\2"', content)
    
    # 2. onclick="func(\'${...}\')" (escaped)
    new_content = re.sub(r"onclick=\\\"([a-zA-Z0-9_]+)\(\'(\${[^}]+})\'[^)]*\\\) \?", r'data-action="\1" data-arg="\2"', new_content)

    # 3. onclick="func('staticArg')"
    new_content = re.sub(r'onclick="([a-zA-Z0-9_]+)\(\'([a-zA-Z0-9_-]+)\'\)"', r'data-action="\1" data-arg="\2"', new_content)

    # 4. onclick="func()"
    new_content = re.sub(r'onclick="([a-zA-Z0-9_]+)\(\)"', r'data-action="\1"', new_content)

    # 4b. onchange="func()"
    new_content = re.sub(r'onchange="([a-zA-Z0-9_]+)\(\)"', r'data-action="\1"', new_content)

    # 4c. onchange="func(arg, this.checked)" -> data-action="func" data-arg="arg"
    new_content = re.sub(r'onchange="([a-zA-Z0-9_]+)\(([^,)]+),[^)]+\)"', r'data-action="\1" data-arg="\2"', new_content)

    # 5. onclick="location.reload()"
    new_content = re.sub(r'onclick="location\.reload\(\)"', r'data-action="reload"', new_content)
    
    # 6. onclick="event.stopPropagation()"
    new_content = re.sub(r'onclick="event\.stopPropagation\(\)"', r'data-action="stopEvent"', new_content)

    # 7. onclick="func('${arg}', ${idx})" -> multi-arg support
    # We'll just pass the whole thing as a string and parse in ui-init.js
    new_content = re.sub(r'onclick="([a-zA-Z0-9_]+)\(([^)]+)\)"', r'data-action="\1" data-arg="\2"', new_content)

    with open(filepath, 'w') as f:
        f.write(new_content)

files = [
    'public/js/admin-dashboard.js',
    'public/js/finance-dashboard.js',
    'public/js/support-dashboard.js',
    'public/driver-app/index.html',
    'public/support-dashboard.html',
    'public/verify.html'
]

for f in files:
    full_path = os.path.join('/home/user/qscrap.qa', f)
    if os.path.exists(full_path):
        print(f"Hardening {f}...")
        harden_templates(full_path)
    else:
        print(f"Skipping {f} (not found)")
