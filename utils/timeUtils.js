export const getCurrentColombiaTimeISO = () => {
    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
    return colombiaTime.toISOString();
  };
  