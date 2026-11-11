// Mirrors the seeded catalog (prices as Prisma Decimal-like objects).
const decimal = (value) => ({ toString: () => String(value), valueOf: () => value });
export const seeded = [
  { id: 11, name: 'Wireless Mouse', description: 'Quiet wireless mouse with adjustable sensitivity and USB receiver.', category: 'Accessories', price: decimal(650), stock: 12, active: true },
  { id: 12, name: 'Compact Mechanical Keyboard', description: 'Hot-swappable compact keyboard with tactile switches.', category: 'Accessories', price: decimal(1850), stock: 8, active: true },
  { id: 13, name: 'USB-C Study Lamp', description: 'Adjustable desk lamp with three brightness levels.', category: 'Study', price: decimal(900), stock: 10, active: true },
  { id: 14, name: '1080p Webcam', description: 'Full HD webcam with privacy cover and built-in microphone.', category: 'Video', price: decimal(1450), stock: 6, active: true },
  { id: 15, name: 'Laptop Stand', description: 'Foldable aluminum stand for laptops up to 16 inches.', category: 'Study', price: decimal(1200), stock: 9, active: true },
  { id: 16, name: 'USB Headset', description: 'Over-ear headset with noise-reducing boom microphone.', category: 'Audio', price: decimal(1350), stock: 7, active: true }
];
