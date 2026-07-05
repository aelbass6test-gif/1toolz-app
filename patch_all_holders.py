import re

with open('components/POSPage.tsx', 'r') as f:
    content = f.read()

old_code = """  const allPossibleHolders = useMemo(() => [
    { id: 'admin', name: 'المدير (أنت)' },
    ...(employeesList).map((e, index) => ({ id: `emp_${e.id || e.phone || index}`, name: normalizeName(e.name) })),
    ...(partnersList).map((p, index) => ({ id: `part_${p.id || index}`, name: `${normalizeName(p.name)} (شريك)` })),
    ...(treasuryAccountsList).filter(a => a.type === 'custody').map(a => ({ id: `treas_${a.id}`, name: normalizeName(a.name) }))
  ], [employeesList, partnersList, treasuryAccountsList]);"""

new_code = """  const allPossibleHolders = useMemo(() => [
    { id: 'admin', name: 'المدير (أنت)' },
    ...(employeesList).map((e, index) => ({ id: `emp_${e.id || e.phone || index}`, name: normalizeName(e.name) })),
    ...(partnersList).map((p, index) => ({ id: `part_${p.id || index}`, name: `${normalizeName(p.name)} (شريك)` })),
    ...(treasuryAccountsList).map((a: any) => ({ id: `treas_${a.id}`, name: normalizeName(a.name) }))
  ], [employeesList, partnersList, treasuryAccountsList]);"""

content = content.replace(old_code, new_code)

with open('components/POSPage.tsx', 'w') as f:
    f.write(content)
