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
  return date.toISOString().split("T")[0];
}


// GET UPCOMING MATCHES
app.get("/api/matches", async (req, res) => {

  try {

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API_FOOTBALL_KEY is not configured"
      });
    }


    const today = new Date();

    const future = new Date(today);

    future.setUTCDate(
      future.getUTCDate() + 7
    );


    const from = formatDate(today);
    const to = formatDate(future);


    console.log(
      `Loading fixtures from ${from} to ${to}`
    );


    const url =
      `${API_URL}/fixtures?from=${from}&to=${to}`;


    const response = await fetch(url, {
      headers: {
        "x-apisports-key": API_KEY
      }
    });


    if (!response.ok) {

      throw new Error(
        `Football API returned ${response.status}`
      );

    }


    const data = await response.json();


    const fixtures =
      data.response || [];


    // Only upcoming matches
    const upcoming =
      fixtures.filter(match => {

        const status =
          match.fixture?.status?.short;

        return (
          status === "NS" ||
          status === "TBD"
        );

      });


    // Convert API data for website
    const matches =
      upcoming.map(match => {

        return {

          id: match.fixture.id,

          league:
            match.league?.name ||
            "Football",

          country:
            match.league?.country ||
            "",

          home:
            match.teams?.home?.name ||
            "Home Team",

          away:
            match.teams?.away?.name ||
            "Away Team",

          time:
            match.fixture?.date ||
            "",

          status:
            match.fixture?.status?.short ||
            "NS",


          // Temporary prediction values
          over05: 90,
          over15: 75,
          over25: 55,
          over35: 35,

          under15: 25,
          under25: 45,
          under35: 65

        };

      });


    // Sort by kickoff time
    matches.sort((a, b) => {

      return (
        new Date(a.time) -
        new Date(b.time)
      );

    });


    res.json({

      success: true,

      from: from,

      to: to,

      count: matches.length,

      matches: matches

    });


  } catch (error) {

    console.error(error);


    res.status(500).json({

      success: false,

      message:
        "Unable to load football matches",

      error:
        error.message

    });

  }

});


// HEALTH CHECK
app.get("/health", (req, res) => {

  res.json({
    status: "OK"
  });

});


// START SERVER
app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
