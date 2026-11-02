// Curated top 5 recommendations based on input query
export const getTop5Recommendations = (inputQuery) => {
  const query = (inputQuery || "").toLowerCase();

  if (query.includes("starboy") || query.includes("weeknd")) {
    return [
      { rank: 1, title: "Can't Feel My Face", artist: "The Weeknd", score: "98.2%", duration: "3:35" },
      { rank: 2, title: "One More Time", artist: "Daft Punk", score: "97.4%", duration: "5:20" },
      { rank: 3, title: "Blinding Lights", artist: "The Weeknd", score: "96.8%", duration: "3:20" },
      { rank: 4, title: "Instant Crush", artist: "Daft Punk ft. Julian Casablancas", score: "95.5%", duration: "5:37" },
      { rank: 5, title: "Midnight City", artist: "M83", score: "94.8%", duration: "4:03" }
    ];
  }

  if (query.includes("creep") || query.includes("radiohead")) {
    return [
      { rank: 1, title: "Karma Police", artist: "Radiohead", score: "98.7%", duration: "4:24" },
      { rank: 2, title: "Black", artist: "Pearl Jam", score: "97.5%", duration: "5:44" },
      { rank: 3, title: "High and Dry", artist: "Radiohead", score: "96.9%", duration: "4:17" },
      { rank: 4, title: "Smells Like Teen Spirit", artist: "Nirvana", score: "95.8%", duration: "5:01" },
      { rank: 5, title: "Fake Plastic Trees", artist: "Radiohead", score: "95.1%", duration: "4:50" }
    ];
  }

  // Default / "The Scientist" or general query
  return [
    { rank: 1, title: "Chasing Cars", artist: "Snow Patrol", score: "98.4%", duration: "4:27" },
    { rank: 2, title: "Fix You", artist: "Coldplay", score: "97.8%", duration: "4:55" },
    { rank: 3, title: "How to Save a Life", artist: "The Fray", score: "96.9%", duration: "4:22" },
    { rank: 4, title: "Skinny Love", artist: "Bon Iver", score: "95.7%", duration: "3:58" },
    { rank: 5, title: "Somewhere Only We Know", artist: "Keane", score: "94.9%", duration: "3:57" }
  ];
};

export const sampleSuggestions = [
  "The Scientist",
  "Creep",
  "Starboy",
  "Dreams",
  "Midnight City"
];