export const sampleConfig = {
  defaults: {
    lcp: { max: 4000 },
    tbt: { max: 500 },
    cls: { max: 0.2 },
    score: { min: 70 },
  },
  monitorings: {
    101: {
      lcp: { max: 2500 }, // tighter override for this page
    },
  },
};
