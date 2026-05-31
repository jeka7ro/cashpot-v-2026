with open('server.py', 'r') as f:
    content = f.read()

parts = content.split("if __name__ == '__main__':")
if len(parts) == 2:
    # Everything after app.run goes before if __name__
    main_block = "if __name__ == '__main__':" + parts[1]
    
    # Wait, parts[1] contains app.run and also the appended endpoint.
    # Let's split parts[1] by "@app.route('/api/reports/expenses')"
    sub_parts = parts[1].split("@app.route('/api/reports/expenses')")
    if len(sub_parts) > 1:
        app_run_code = sub_parts[0]
        endpoint_code = "@app.route('/api/reports/expenses')" + sub_parts[1]
        
        new_content = parts[0] + endpoint_code + "\nif __name__ == '__main__':" + app_run_code
        with open('server.py', 'w') as f:
            f.write(new_content)
