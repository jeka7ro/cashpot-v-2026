from datetime import datetime
import calendar

def sanitize_date(d_str):
    if not d_str:
        return d_str
    parts = d_str.split('-')
    if len(parts) == 3:
        try:
            y = int(parts[0])
            m = int(parts[1])
            d = int(parts[2])
            
            # clamp month
            if m < 1: m = 1
            if m > 12: m = 12
            
            # clamp day
            _, last_day = calendar.monthrange(y, m)
            if d < 1: d = 1
            if d > last_day: d = last_day
            
            return f"{y:04d}-{m:02d}-{d:02d}"
        except:
            pass
    return d_str

print(sanitize_date('2026-06-31'))
print(sanitize_date('2026-02-29'))
