const r = {
  "bet": 112808.49999999999,
  "cabinet": "EGT Premier",
  "days_active": 31,
  "ggr": 3667.27,
  "in_val": 116475.76999999997,
  "location_name": "Craiova",
  "marketing": 5385.0,
  "month": "2025-08",
  "ngr": 1717.73,
  "out_val": 112808.49999999999,
  "provider": "EGT",
  "serial_nr": "190271",
  "win": 112808.49999999999
};
const daysActive = (+r.days_active || 0);
console.log(daysActive);
console.log(daysActive >= 3);
