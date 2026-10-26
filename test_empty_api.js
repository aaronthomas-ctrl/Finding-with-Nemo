const req = {
  textQuery: "some weird business name that doesn't exist",
  locationRestriction: {
    rectangle: {
      low: { latitude: 24.4, longitude: 54.3 },
      high: { latitude: 24.5, longitude: 54.4 }
    }
  }
};
fetch("http://localhost:3000/api/places-search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(req)
}).then(r => r.json()).then(console.log).catch(console.error);
