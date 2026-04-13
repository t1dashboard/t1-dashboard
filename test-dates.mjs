const d = new Date('2027-08-31 0:00:00');
console.log('Parsed 2027-08-31 0:00:00:', d, 'Valid:', d.getTime() > 0);
const d2 = new Date('2026-04-20 0:00:00');
console.log('Parsed 2026-04-20 0:00:00:', d2, 'Valid:', d2.getTime() > 0);

// Check compliance dates within 15 days
const now = new Date();
now.setHours(0,0,0,0);
const fifteenDays = new Date(now);
fifteenDays.setDate(now.getDate() + 15);
console.log('Today:', now.toISOString());
console.log('15 days out:', fifteenDays.toISOString());

// Test a compliance date that should be in range
const testDate = new Date('2026-04-20 0:00:00');
testDate.setHours(0,0,0,0);
console.log('Test date:', testDate.toISOString(), 'In range:', testDate >= now && testDate <= fifteenDays);

// Check if the actual compliance dates (2027) are in range
const farDate = new Date('2027-08-31 0:00:00');
farDate.setHours(0,0,0,0);
console.log('Far date:', farDate.toISOString(), 'In range:', farDate >= now && farDate <= fifteenDays);
