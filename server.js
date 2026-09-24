// ==============================
// API DIAGNOSTIC
// ==============================

app.get("/api/debug", async (req, res) => {

  try {

    const today = new Date();

    const results = [];

    for (let i = 0; i < 7; i++) {

      const date = new Date(today);

      date.setUTCDate(
        date.getUTCDate() + i
      );

      const dateString =
        formatDate(date);

      const fixtures =
        await getFixtures(dateString);

      const statuses = {};

      fixtures.forEach(fixture => {

        const status =
          fixture.fixture?.status?.short || "UNKNOWN";

        statuses[status] =
          (statuses[status] || 0) + 1;

      });

      results.push({

        date: dateString,

        totalFixtures:
          fixtures.length,

        statuses:
          statuses

      });

    }

    res.json({

      success: true,

      results: results

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});
   
