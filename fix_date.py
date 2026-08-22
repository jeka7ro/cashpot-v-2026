from datetime import datetime

def parse_date(date_str):
    try:
        # Try YYYY-MM-DD
        return datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
    except:
        pass
    try:
        # Try DD.MM.YYYY
        return datetime.strptime(date_str, '%d.%m.%Y').strftime('%Y-%m-%d')
    except:
        pass
    # default fallback
    return datetime.now().strftime('%Y-%m-%d')

print(parse_date('01.05.2026'))
print(parse_date('2026-06-31')) # Wait, python's strptime for 2026-06-31 will throw ValueError!
