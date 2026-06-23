
def find_unbalanced_quotes(filepath):
    content = open(filepath).read()
    lines = content.splitlines()
    
    in_triple_single = False
    in_triple_double = False
    
    for i, line in enumerate(lines):
        # This is a very simple check and won't handle all cases (like quotes inside quotes)
        # but it might help find the obvious one.
        
        # Count non-escaped triple quotes
        ts = line.count("'''")
        td = line.count('"""')
        
        if ts % 2 != 0:
            in_triple_single = not in_triple_single
            print(f"Line {i+1}: Triple single flip to {in_triple_single}")
        if td % 2 != 0:
            in_triple_double = not in_triple_double
            print(f"Line {i+1}: Triple double flip to {in_triple_double}")
            
    print(f"Final state: TS={in_triple_single}, TD={in_triple_double}")

find_unbalanced_quotes('server.py')
