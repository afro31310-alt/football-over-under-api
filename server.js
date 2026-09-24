const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_URL = "https://v3.football.api-sports.io";

/*
  Home route
*/
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Football Over/Under API is running"
  });
});


/*
  Get upcoming fixtures
*/
app.get("/api/matches", async (req, res) => {

  try {

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API_FOOTBALL_KEY is not configured"
      });
    }

    /*
      Get today's fixtures.

      The date can also be supplied:
      /api/matches?date=2026-09-24
    */

    const date =
      req.query.date ||
      new Date().toISOString().split("T")[0];


    const response = await fetch(
      `${API_URL}/fixtures?date=${date}&status=NS`
      ,
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );


    if (!response.ok) {

      return res.status(response.status).json({
        success: false,
        message: "Football API request failed"
      });

    }


    const data = await response.json();


    if (!data.response) {

      return res.json({
        success: true,
        matches: []
      });

    }


    /*
      Convert API-Football data into
      the format used by our website.
    */

    const matches = data.response.map(match => {

      return {

        id: match.fixture.id,

        league:
          match.league?.name || "Football",

        country:
          match.league?.country || "",

        home:
          match.teams?.home?.name || "Home Team",

        away:
          match.teams?.away?.name || "Away Team",

        time:
          match.fixture?.date || "",

        status:
          match.fixture?.status?.short || "NS",

        /*
          Temporary statistical estimates.

          These will be replaced with the
          full prediction engine later.
        */

        over05: 90,
        over15: 75,
        over25: 55,
        over35: 35,

        under15: 25,
        under25: 45,
        under35: 65

      };

    });


    res.json({

      success: true,

      date: date,

      count: matches.length,

      matches: matches

    });


  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      message: "Server error",
      error: error.message

    });

  }

});


/*
  Health check
*/

app.get("/health", (req, res) => {

  res.json({
    status: "OK"
  });

});


app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
