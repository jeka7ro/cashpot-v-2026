with open('dashboard2.js', 'r') as f:
    content = f.read()

# The injected charts code starts with "// --- 1. TOP & BOTTOM SĂLI ---"
# and ends right before "async function initDashboard2() {"
import re

# Find the block of injected code in global scope
start_marker = "    // --- 1. TOP & BOTTOM SĂLI ---"
end_marker = "async function initDashboard2() {"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)
    
    charts_code = content[start_idx:end_idx]
    
    # Remove it from global scope
    content = content[:start_idx] + content[end_idx:]
    
    # Now insert it at the end of fetchAndRenderSecondary.
    # The end of fetchAndRenderSecondary is right before start_idx (since it was just before initDashboard2 before injection).
    # Wait, before injection, it was:
    #         }, true);
    #     }
    # }
    # 
    # async function initDashboard2() {
    
    # We need to find the "}\n}" that closes fetchAndRenderSecondary.
    # Let's search for the end of EXPENSES BY LOCATION which is:
    #         }, true);
    #     }
    
    marker2 = "        }, true);\n    }\n"
    insert_pos = content.find(marker2)
    if insert_pos != -1:
        insert_pos += len(marker2)
        content = content[:insert_pos] + "\n" + charts_code + content[insert_pos:]
        
    with open('dashboard2.js', 'w') as f:
        f.write(content)
        print("Success")
else:
    print("Markers not found")
