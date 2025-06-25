export const generateId = (): string => {
  const timestamps = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${timestamps}${random}`;
};
