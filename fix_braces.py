with open("components/SuppliersPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

target = """                      } else if (!isShipping && expensePaidBy === 'المحفظة العامة') {
                          newBalance -= amount;
                      
                  };"""

replacement = """                      } else if (!isShipping && expensePaidBy === 'المحفظة العامة') {
                          newBalance -= amount;
                      }
                  };"""

if target in content:
    content = content.replace(target, replacement)
    with open("components/SuppliersPage.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed brace mismatch")
else:
    print("Could not find target")
