const { jsPDF } = require("jspdf");
const doc = new jsPDF({
  orientation: 'landscape',
  unit: 'mm',
  format: [297, 1000]
});
console.log("jsPDF page size:", doc.internal.pageSize.width, doc.internal.pageSize.height);
