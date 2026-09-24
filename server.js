const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_URL = "https://v3.football.api-sports.io";


// HOME
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Football Over/Under API is running"
  });
});


// FORMAT DATE
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}


// GET FIXTURES FOR ONE DATE
async function getFixtures(date) {

  const url =
    `${API_URL}/fixtures?date=${date}`;

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
      `API returned ${response.status}`
    );
  }

  return data.response || [];
}


// MATCHES
app.get("/api/matches", async (req, res) => {

  try {

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API_FOOTBALL_KEY is not configured"
      });
    }


    const matches = [];

    const today = new Date();


    // Check today + next 6 days
    for (let i = 0; i < 7; i++) {

      const date = new Date(today);

      date.setUTCDate(
        date.getUTCDate() + i
      );

      const dateString =
        formatDate(date);


      console.log(
        `Checking ${dateString}`
      );


      const fixtures =
        await getFixtures(dateString);


      for (const fixture of fixtures) {

        const status =
          fixture.fixture?.status?.short;


        // Only upcoming fixtures
        if (
          status !== "NS" &&
          status !== "TBD"
        ) {
          continue;
        }


        matches.push({

          id: fixture.fixture.id,

          league:
            fixture.league?.name ||
            "Football",

          country:
            fixture.league?.country ||
            "",

          home:
            fixture.teams?.home?.name ||
            "Home Team",

          away:
            fixture.teams?.away?.name ||
            "Away Team",

          time:
            fixture.fixture?.date ||
            "",

          status:
            status || "NS",


          // Temporary values
          over05: 90,
          over15: 75,
          over25: 55,
          over35: 35,

          under15: 25,
          under25: 45,
          under35: 65

        });

      }

    }


    // Remove duplicate matches
    const uniqueMatches =
      Array.from(
        new Map(
          matches.map(match => [
            match.id,
            match
          ])
        ).values()
      );


    // Sort by kickoff time
    uniqueMatches.sort((a, b) => {

      return (
        new Date(a.time) -
        new Date(b.time)
      );

    });


    res.json({

      success: true,

      count: uniqueMatches.length,

      matches: uniqueMatches

    });


  } catch (error) {

    console.error(
      "MATCH ERROR:",
      error
    );


    res.status(500).json({

      success: false,

      message:
        "Unable to load football matches",

      error:
        error.message

    });

  }

});


// HEALTH
app.get("/health", (req, res) => {

  res.json({
    status: "OK"
  });

});


// START
app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
