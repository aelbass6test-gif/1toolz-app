const fs = require('fs');
let code = fs.readFileSync('components/BostaSystemPortal.tsx', 'utf8');

code = code.replace(
  "      defaultPackageSize: 'SMALL',\n      allowToOpenPackage: true,",
  "      defaultPackageSize: 'SMALL',\n      defaultBusinessLocationId: '',\n      defaultReturnLocationId: '',\n      allowToOpenPackage: true,"
);

fs.writeFileSync('components/BostaSystemPortal.tsx', code);
