const fs = require('fs');
let code = fs.readFileSync('components/BostaSystemPortal.tsx', 'utf8');

// We need to inject states for business locations and fetching logic
code = code.replace(
  '  const [showApiKey, setShowApiKey] = useState<boolean>(false);',
  `  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [businessLocations, setBusinessLocations] = useState<any[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  useEffect(() => {
    if (apiSettings.apiKey && apiSettings.isActive) {
      fetchBusinessLocations(apiSettings.apiKey, apiSettings.environment === 'staging');
    }
  }, [apiSettings.apiKey, apiSettings.isActive, apiSettings.environment]);

  const fetchBusinessLocations = async (key: string, isStaging: boolean) => {
    try {
      setIsLoadingLocations(true);
      const res = await bostaService.getBusinessLocations(key, isStaging);
      if (res && res.success && res.data) {
        setBusinessLocations(Array.isArray(res.data) ? res.data : (res.data.list || res.data.locations || []));
      }
    } catch (e) {
      console.error("Failed to load business locations", e);
    } finally {
      setIsLoadingLocations(false);
    }
  };`
);

// We need to add state for these to apiSettings
code = code.replace(
  '    defaultPackageSize: settings?.bostaConfig?.defaultPackageSize || \'SMALL\',',
  `    defaultPackageSize: settings?.bostaConfig?.defaultPackageSize || 'SMALL',
    defaultBusinessLocationId: settings?.bostaConfig?.defaultBusinessLocationId || '',
    defaultReturnLocationId: settings?.bostaConfig?.defaultReturnLocationId || '',`
);
// And to reset logic
code = code.replace(
  "      defaultPackageSize: 'SMALL',",
  "      defaultPackageSize: 'SMALL',\n      defaultBusinessLocationId: '',\n      defaultReturnLocationId: '',"
);

// And to save logic (there are 3 places)
code = code.replace(
  '          defaultPackageSize: apiSettings.defaultPackageSize as any,',
  `          defaultPackageSize: apiSettings.defaultPackageSize as any,
          defaultBusinessLocationId: apiSettings.defaultBusinessLocationId,
          defaultReturnLocationId: apiSettings.defaultReturnLocationId,`
);
code = code.replace(
  '      defaultPackageSize: apiSettings.defaultPackageSize as any,',
  `      defaultPackageSize: apiSettings.defaultPackageSize as any,
      defaultBusinessLocationId: apiSettings.defaultBusinessLocationId,
      defaultReturnLocationId: apiSettings.defaultReturnLocationId,`
);
code = code.replace(
  '          defaultPackageSize: apiSettings.defaultPackageSize as any,',
  `          defaultPackageSize: apiSettings.defaultPackageSize as any,
          defaultBusinessLocationId: apiSettings.defaultBusinessLocationId,
          defaultReturnLocationId: apiSettings.defaultReturnLocationId,`
);


// Now inject the UI for it under the Package Size
const uiCode = `
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">مرسل من متجر / الفرع (Business Location):</label>
                    <div className="relative">
                      <select 
                        value={apiSettings.defaultBusinessLocationId}
                        onChange={(e) => setApiSettings({...apiSettings, defaultBusinessLocationId: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white appearance-none"
                      >
                        <option value="">-- الافتراضي (حسب الحساب) --</option>
                        {businessLocations.map(loc => (
                          <option key={loc._id} value={loc._id}>{loc.name || loc.nameAr} - {loc.city?.nameAr || loc.city?.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">موقع إرجاع الشحنة (Return Location):</label>
                    <div className="relative">
                      <select 
                        value={apiSettings.defaultReturnLocationId}
                        onChange={(e) => setApiSettings({...apiSettings, defaultReturnLocationId: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white appearance-none"
                      >
                        <option value="">-- نفس موقع الإرسال / الافتراضي --</option>
                        {businessLocations.map(loc => (
                          <option key={loc._id} value={loc._id}>{loc.name || loc.nameAr} - {loc.city?.nameAr || loc.city?.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
`;

code = code.replace(
  '                    </select>\n                  </div>\n                </div>',
  '                    </select>\n                  </div>\n' + uiCode + '\n                </div>'
);

fs.writeFileSync('components/BostaSystemPortal.tsx', code);
