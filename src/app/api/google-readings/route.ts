export const runtime = "nodejs"; // ensure Node.js runtime

// 🗂 Cache the latest good data + timestamp
let cachedData: {
  aqi: number | null;
  uv: number | null;
  heat: number | null;
  pm25?: number;
  source?: string;
  locationName?: string;
  uvSource?: string;
  uvLocation?: string;
  heatSource?: string;
  heatLocation?: string;
  lastUpdated?: number;
} = { aqi: null, uv: null, heat: null };

export async function GET() {
  const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;
  const OPENAQ_KEY = process.env.OPENAQ_KEY;
  const IQAIR_KEY = process.env.IQAIR_KEY;

  if (!OPENWEATHER_KEY || !OPENAQ_KEY || !IQAIR_KEY) {
    console.error("❌ Missing API keys", {
      OPENWEATHER_KEY,
      OPENAQ_KEY,
      IQAIR_KEY,
    });
    return Response.json({ error: "Missing API keys" }, { status: 500 });
  }

  const location = { latitude: 14.566436, longitude: 120.992391 }; // Manila center

  try {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // 🛑 Use cached data if < 1 hour old
    if (cachedData.lastUpdated && now - cachedData.lastUpdated < oneHour) {
      console.log("⚡ Using cached data:", cachedData);
      return Response.json(cachedData);
    }

    // 🌍 Step 1: IQAir API (nearest city to Manila)
    try {
      const iqRes = await fetch(
        `http://api.airvisual.com/v2/nearest_city?lat=14.5995&lon=120.9842&key=${IQAIR_KEY}`
      );
      const iqJson = await iqRes.json();
      console.log("🌍 IQAir Manila:", iqJson);

      if (iqJson?.status === "success") {
        const { city, state, country } = iqJson.data;

        cachedData.aqi = iqJson.data.current.pollution.aqius;
        cachedData.pm25 =
          iqJson.data.current.pollution.mainus === "p2"
            ? iqJson.data.current.pollution.aqius
            : undefined;
        cachedData.source = "IQAir";
        cachedData.locationName = `${city}, ${country}`;
        cachedData.lastUpdated = now;
      }
    } catch (e) {
      console.error("❌ IQAir error:", e);
    }

    // ☀️ UV Index
    try {
      const uvRes = await fetch(
        `https://currentuvindex.com/api/v1/uvi?latitude=${location.latitude}&longitude=${location.longitude}`
      );
      const uvJson = await uvRes.json();
      const uv =
        uvJson.result?.uv?.now?.uvi ??
        uvJson.uv?.now?.uvi ??
        uvJson.now?.uvi ??
        null;
      if (uv !== null) {
        cachedData.uv = uv;
        cachedData.uvSource = "CurrentUVIndex API";
        cachedData.uvLocation = "Manila, Philippines";
      }
    } catch (e) {
      console.error("❌ UV API error:", e);
    }

    // 🌡 OpenWeather Heat
    try {
      const owRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=manila,ph&units=metric&appid=${OPENWEATHER_KEY}`
      );
      const owJson = await owRes.json();
      const temp =
        typeof owJson.main?.temp === "number"
          ? owJson.main.temp
          : typeof owJson.main?.feels_like === "number"
          ? owJson.main.feels_like
          : null;
      if (temp !== null) {
        cachedData.heat = Number(temp.toFixed(1));
        cachedData.heatSource = "OpenWeather";
        cachedData.heatLocation = `${owJson.name}, ${owJson.sys.country}`;
      }
    } catch (e) {
      console.error("❌ OpenWeather error:", e);
    }

    console.log("✅ Latest cached data:", cachedData);
    return Response.json(cachedData); // ✅ Correct way in Next.js
  } catch (err) {
    console.error("❌ API fetch error:", err);
    return Response.json(cachedData);
  }
}
