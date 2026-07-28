import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(options=options)
try:
    print("Navigating to dashboard...")
    driver.get("http://localhost:5050/#dashboard")
    time.sleep(5)
    
    # Check if loader is visible
    loader_display = driver.execute_script("return window.getComputedStyle(document.getElementById('loader')).display;")
    print(f"Loader display: {loader_display}")
    
    # Check console logs
    print("\n--- Console Logs ---")
    for entry in driver.get_log('browser'):
        print(entry['message'])
finally:
    driver.quit()
