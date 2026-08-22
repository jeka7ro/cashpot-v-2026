import re

with open("index.html", "r") as f:
    content = f.read()

# 1. Remove the modal
modal_start = content.find('  <!-- Machine Full Details Modal -->')
script_end = content.find('</script>\n</body>')
if modal_start != -1 and script_end != -1:
    content = content[:modal_start] + content[script_end:]
    print("Removed modal from end.")

# 2. Insert new page after id="view-game-details"
game_details_page_pattern = re.search(r'id="view-game-details" class="rep-page"[^>]*>.*?(?=      <!--[^-]+-->\n      <div id=")', content, re.DOTALL)
# wait, it's easier to just insert before the closing of #rep-container. 
# rep-container ends right before </div>\n    </div>\n  </div>\n\n  <!-- Mobile Navigation -->
mobile_nav_idx = content.find('  <!-- Mobile Navigation -->')
if mobile_nav_idx != -1:
    # go back to the closing div of rep-container
    insert_idx = content.rfind('      </div>\n    </div>\n  </div>', 0, mobile_nav_idx)
    
    new_page = """
      <!-- Machine Full Details Page -->
      <div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">
        
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
            <div>
                <button onclick="closeMachineDetails()" class="btn btn-secondary" style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Înapoi la Performanță Reset
                </button>
                <h3 class="glass-title" style="margin-bottom:4px; font-size:28px;">Aparat <span id="md-serial" style="color:var(--accent);">...</span></h3>
                <div style="display:flex; gap:16px; color:var(--text-muted); font-size:14px; font-weight:500;">
                    <span style="display:flex; align-items:center; gap:6px;">🕹️ <span id="md-mix" style="color:#fff;">...</span></span>
                    <span style="display:flex; align-items:center; gap:6px;">📍 <strong id="md-loc" style="color:var(--text);">...</strong></span>
                </div>
            </div>
        </div>

        <!-- Quick Stats -->
        <div style="display:flex; gap:20px; margin-bottom:24px;">
            <div style="flex:1; background:rgba(16,185,129,0.1); padding:20px; border-radius:12px; border:1px solid rgba(16,185,129,0.2);">
                <div style="font-size:12px; color:var(--success); text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:4px;">Lifetime IN</div>
                <div id="md-stat-in" style="font-size:28px; font-weight:800; color:#fff;">0.00</div>
            </div>
            <div style="flex:1; background:rgba(239,68,68,0.1); padding:20px; border-radius:12px; border:1px solid rgba(239,68,68,0.2);">
                <div style="font-size:12px; color:var(--danger); text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:4px;">Lifetime OUT</div>
                <div id="md-stat-out" style="font-size:28px; font-weight:800; color:#fff;">0.00</div>
            </div>
            <div style="flex:1; background:rgba(234,179,8,0.1); padding:20px; border-radius:12px; border:1px solid rgba(234,179,8,0.2);">
                <div style="font-size:12px; color:#eab308; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:4px;">Total Jackpot</div>
                <div id="md-stat-jp" style="font-size:28px; font-weight:800; color:#fff;">0.00</div>
            </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex; border-bottom:1px solid var(--border); margin-bottom:24px; gap:8px;">
            <div class="md-tab active" onclick="switchMdTab('loc', event)" style="padding:12px 24px; cursor:pointer; font-weight:700; font-size:14px; border-bottom:3px solid var(--accent); color:var(--accent); letter-spacing:0.5px;">ISTORIC SĂLI</div>
            <div class="md-tab" onclick="switchMdTab('res', event)" style="padding:12px 24px; cursor:pointer; font-weight:700; font-size:14px; border-bottom:3px solid transparent; color:var(--text-muted); letter-spacing:0.5px;">ISTORIC RESET-URI</div>
            <div class="md-tab" onclick="switchMdTab('pay', event)" style="padding:12px 24px; cursor:pointer; font-weight:700; font-size:14px; border-bottom:3px solid transparent; color:var(--text-muted); letter-spacing:0.5px;">PLĂȚI MARI (>1000 RON)</div>
        </div>

        <!-- Content Area -->
        <div style="flex:1;">
            
            <!-- Locatii -->
            <div id="md-content-loc" style="display:block;">
                <div class="table-container" style="padding:0; border-radius:12px; overflow:hidden;">
                    <table class="data-table" id="md-loc-table" style="margin:0;">
                        <thead>
                            <tr>
                                <th>NR. CRT.</th>
                                <th>LOCAȚIE</th>
                                <th>DATA INTRĂRII</th>
                                <th>DATA IEȘIRII</th>
                                <th style="text-align:right;">IN</th>
                                <th style="text-align:right;">OUT</th>
                                <th style="text-align:right;">JACKPOT</th>
                                <th style="text-align:right;">HAPPY HOUR</th>
                                <th style="text-align:right;">GGR</th>
                                <th style="text-align:right;">RTP %</th>
                            </tr>
                        </thead>
                        <tbody id="md-loc-tbody"></tbody>
                        <tfoot id="md-loc-tfoot">
                            <tr>
                                <th colspan="4" style="text-align:right;">TOTAL:</th>
                                <th id="md-loc-tot-in" style="text-align:right;">0.00</th>
                                <th id="md-loc-tot-out" style="text-align:right;">0.00</th>
                                <th id="md-loc-tot-jp" style="text-align:right;">0.00</th>
                                <th id="md-loc-tot-hh" style="text-align:right;">0.00</th>
                                <th id="md-loc-tot-ggr" style="text-align:right;">0.00</th>
                                <th id="md-loc-tot-rtp" style="text-align:right;">0.00%</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="pg-md-loc" class="pagination-container" style="margin-top:16px;"></div>
            </div>

            <!-- Resets -->
            <div id="md-content-res" style="display:none;">
                <div class="table-container" style="padding:0; border-radius:12px; overflow:hidden;">
                    <table class="data-table" id="md-res-table" style="margin:0;">
                        <thead>
                            <tr>
                                <th>NR. CRT.</th>
                                <th>DATA RESET</th>
                                <th>LOCAȚIE</th>
                            </tr>
                        </thead>
                        <tbody id="md-res-tbody"></tbody>
                        <tfoot id="md-res-tfoot">
                            <tr>
                                <th colspan="3" style="text-align:right;">TOTAL: <span id="md-res-tot">0</span></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="pg-md-res" class="pagination-container" style="margin-top:16px;"></div>
            </div>

            <!-- Payouts -->
            <div id="md-content-pay" style="display:none;">
                <div class="table-container" style="padding:0; border-radius:12px; overflow:hidden;">
                    <table class="data-table" id="md-pay-table" style="margin:0;">
                        <thead>
                            <tr>
                                <th>NR. CRT.</th>
                                <th>DATA</th>
                                <th>LOCAȚIE</th>
                                <th style="text-align:right;">OUT CASH</th>
                                <th style="text-align:right;">JACKPOT</th>
                                <th style="text-align:right;">HAPPY HOUR</th>
                            </tr>
                        </thead>
                        <tbody id="md-pay-tbody"></tbody>
                        <tfoot id="md-pay-tfoot">
                            <tr>
                                <th colspan="3" style="text-align:right;">TOTAL:</th>
                                <th id="md-pay-tot-out" style="text-align:right;">0.00</th>
                                <th id="md-pay-tot-jp" style="text-align:right;">0.00</th>
                                <th id="md-pay-tot-hh" style="text-align:right;">0.00</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="pg-md-pay" class="pagination-container" style="margin-top:16px;"></div>
            </div>
            
        </div>
      </div>\n
"""
    content = content[:insert_idx] + new_page + content[insert_idx:]
    with open("index.html", "w") as f:
        f.write(content)
    print("Inserted new page successfully.")
else:
    print("Could not find mobile navigation.")
