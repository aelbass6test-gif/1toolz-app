import re

with open('components/SupplyOrderModal.tsx', 'r') as f:
    content = f.read()

# Update Props
old_props = """  partnerPayments: Array<{ partnerId: string; amount: number }>;
  setPartnerPayments: (payments: any[]) => void;
  totalCost: number;"""
new_props = """  partnerPayments: Array<{ partnerId: string; amount: number }>;
  setPartnerPayments: (payments: any[]) => void;
  custodyPayments?: Array<{ cashHolderId: string; amount: number }>;
  setCustodyPayments?: (payments: any[]) => void;
  cashHolders?: any[];
  totalCost: number;"""
content = content.replace(old_props, new_props)

# Fix Props in function args
old_args = """  treasury,
  partnerPayments,
  setPartnerPayments,
  totalCost,"""
new_args = """  treasury,
  partnerPayments,
  setPartnerPayments,
  custodyPayments = [],
  setCustodyPayments = () => {},
  cashHolders = [],
  totalCost,"""
content = content.replace(old_args, new_args)

# Add Option
old_options = """                    { id: 'treasury', label: 'الخزينة البنكية', icon: Building2, color: 'blue', desc: 'سحب من حساب خزينة أو بنك' },
                    { id: 'credit', label: 'آجل مديونية', icon: CreditCard, color: 'rose', desc: 'تسجيل كحساب دائن للمورد' }"""
new_options = """                    { id: 'treasury', label: 'الخزينة البنكية', icon: Building2, color: 'blue', desc: 'سحب من حساب خزينة أو بنك' },
                    { id: 'custody', label: 'عهدة شخصية', icon: Coins, color: 'teal', desc: 'سحب من العهد وحاملي النقدية' },
                    { id: 'credit', label: 'آجل مديونية', icon: CreditCard, color: 'rose', desc: 'تسجيل كحساب دائن للمورد' }"""
content = content.replace(old_options, new_options)

# Add explanation
old_expl = """                  {paymentMethod === 'partner' && 'تمويل الشركاء المباشر: سيتم توزيع تكلفة الفاتورة على أرصدة الشركاء من حساباتهم الجارية بالتفصيل قبل الشراء.'}
                </p>"""
new_expl = """                  {paymentMethod === 'partner' && 'تمويل الشركاء المباشر: سيتم توزيع تكلفة الفاتورة على أرصدة الشركاء من حساباتهم الجارية بالتفصيل قبل الشراء.'}
                  {paymentMethod === 'custody' && 'سداد من العهد الشخصية (كاشير/مندوب/شريك): سيتم خصم الفاتورة من رصيد العهدة المسجل لديهم.'}
                </p>"""
content = content.replace(old_expl, new_expl)

with open('components/SupplyOrderModal.tsx', 'w') as f:
    f.write(content)
