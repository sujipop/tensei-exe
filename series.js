/* ------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU NEED TO EDIT to change content.

   SERIES (bottom of this file)
     banner     the wide image on the Series page
     bannerPos  which part to show on a computer, e.g. "50% 16%" = centred, 16% down (raise the 2nd number to show lower parts)
     bannerPosM same, for phones
     textPos    "left" or "right" corner for the text on the banner
     poster     the vertical cover image
     oneLiner   the single sentence shown on the Series page banner
     episodes:  title, video (an .mp4 or .m3u8 link, "" = coming soon), thumb, length

   NFT_TENSEI / NFT_ONE_OF_ONE   the trading cards on the NFT page
     name   a label for screen readers      image   a picture link ("" draws a placeholder)
   GALLERY                        the picture + animation grid on the Creator page
     image  a picture link      title  a label for screen readers

   Image links can be a file in the "images" folder, like images/my-pic.webp,
   or a full web link.  Careful: keep the commas, quote marks and { } brackets.
------------------------------------------------------------------- */

window.SITE = {
  profile: "images/creator/sujipop.webp",
  // Opening video on the home page. It plays once on its own (muted), then holds on the last frame ("" = plain title screen).
  // Phones use heroVideoMobile (smaller file).
  heroVideo: "images/hero-intro.mp4",
  heroVideoMobile: "images/hero-intro-m.mp4",
  heroPoster: "images/hero-intro.webp",
  // Story videos on the home page. Each plays once on its own when it scrolls into view, then holds on its last frame.
  beamVideo: "images/beam.mp4",
  beamPoster: "images/beam.webp",
  sujicorpVideo: "images/sujicorp.mp4",
  sujicorpPoster: "images/sujicorp.webp",
  name: "TENSEI.EXE",
  mint: "https://www.launchmynft.io/mint/tensei_exe",
  footer: "Tensei.exe is an original universe by SujiPop.",
  // While true, episodes without a video link show a "pretend this episode ended" test button.
  // Set to false when you go live.
  testMode: true
};

/* ---- NFT cards (placeholders: swap in your real NFT art, any size: it is cropped to a square) ----
   Add or remove lines freely. About 20 per list works well. They loop forever. */
window.NFT_TENSEI = [
  { name: "Tensei 01", image: "images/nft-01.webp" },
  { name: "Tensei 02", image: "images/nft-02.webp" },
  { name: "Tensei 03", image: "images/nft-03.webp" },
  { name: "Tensei 04", image: "images/nft-04.webp" },
  { name: "Tensei 05", image: "images/nft-05.webp" },
  { name: "Tensei 06", image: "images/nft-06.webp" },
  { name: "Tensei 07", image: "images/nft-07.webp" },
  { name: "Tensei 08", image: "images/nft-08.webp" },
  { name: "Tensei 09", image: "images/nft-09.webp" },
  { name: "Tensei 10", image: "images/nft-10.webp" },
  { name: "Tensei 11", image: "images/nft-11.webp" },
  { name: "Tensei 12", image: "images/nft-12.webp" },
  { name: "Tensei 13", image: "images/nft-13.webp" },
  { name: "Tensei 14", image: "images/nft-14.webp" },
  { name: "Tensei 15", image: "images/nft-15.webp" },
  { name: "Tensei 16", image: "images/nft-16.webp" },
  { name: "Tensei 17", image: "images/nft-17.webp" },
  { name: "Tensei 18", image: "images/nft-18.webp" },
  { name: "Tensei 19", image: "images/nft-19.webp" },
  { name: "Tensei 20", image: "images/nft-20.webp" }
];

window.NFT_ONE_OF_ONE = [
  { name: "Tensei 1/1 01", image: "images/oneofone-01.webp", video: "images/oneofone-01.mp4" },
  { name: "Tensei 1/1 02", image: "images/oneofone-02.webp" },
  { name: "Tensei 1/1 03", image: "images/oneofone-03.webp", video: "images/oneofone-03.mp4" },
  { name: "Tensei 1/1 04", image: "images/oneofone-04.webp", video: "images/oneofone-04.mp4" },
  { name: "Tensei 1/1 05", image: "images/oneofone-05.webp" },
  { name: "Tensei 1/1 06", image: "images/oneofone-06.webp" },
  { name: "Tensei 1/1 07", image: "images/oneofone-07.webp", video: "images/oneofone-07.mp4" },
  { name: "Tensei 1/1 08", image: "images/oneofone-08.webp" },
  { name: "Tensei 1/1 09", image: "images/oneofone-09.webp", video: "images/oneofone-09.mp4" },
  { name: "Tensei 1/1 10", image: "images/oneofone-10.webp", video: "images/oneofone-10.mp4" },
  { name: "Tensei 1/1 11", image: "images/oneofone-11.webp" },
  { name: "Tensei 1/1 12", image: "images/oneofone-12.webp" },
  { name: "Tensei 1/1 13", image: "images/oneofone-13.webp", video: "images/oneofone-13.mp4" },
  { name: "Tensei 1/1 14", image: "images/oneofone-14.webp" },
  { name: "Tensei 1/1 15", image: "images/oneofone-15.webp" },
  { name: "Tensei 1/1 16", image: "images/oneofone-16.webp" },
  { name: "Tensei 1/1 17", image: "images/oneofone-17.webp", video: "images/oneofone-17.mp4" },
  { name: "Tensei 1/1 18", image: "images/oneofone-18.webp" },
  { name: "Tensei 1/1 19", image: "images/oneofone-19.webp" }
];

/* ---- Creator gallery ----
   A grid mixing pictures and animations, shown in this order.
   type   "image" or "video"          src   the file (videos: a short silent .mp4 loop)
   poster still frame shown before a video plays     ar   width / height (used by the zoom view)
   size   the tile shape in the grid (leave out for a normal square):
          "big"  large square (2x2)   "wide"  full-width strip   "land"  landscape
          "port" small portrait       "tall"  large portrait
   Tiles lock together like a puzzle, so if you add, remove or reorder pieces,
   keep each group of shapes together (ask Claude to re-fit the grid).
   Keep files small: images ~1000-1800px .webp, videos ~1080px .mp4 with no sound. */
window.GALLERY = [
  { type: "video", name: "Animation 01", src: "images/creator/vid-01.mp4", poster: "images/creator/vid-01.webp", ar: 1, size: "big" },
  { type: "image", name: "Art 01", src: "images/creator/art-01.webp", ar: 1 },
  { type: "image", name: "Art 02", src: "images/creator/art-02.webp", ar: 1 },
  { type: "image", name: "Art 03", src: "images/creator/art-03.webp", ar: 1 },
  { type: "image", name: "Art 04", src: "images/creator/art-04.webp", ar: 1 },
  { type: "video", name: "Animation 05", src: "images/creator/vid-05.mp4", poster: "images/creator/vid-05.webp", ar: 2.759, size: "wide" },
  { type: "image", name: "Art 13", src: "images/creator/art-13.webp", ar: 1.344, size: "land" },
  { type: "image", name: "Art 14", src: "images/creator/art-14.webp", ar: 0.707, size: "port" },
  { type: "image", name: "Art 18", src: "images/creator/art-18.webp", ar: 0.75, size: "port" },
  { type: "image", name: "Art 22", src: "images/creator/art-22.webp", ar: 0.75, size: "tall" },
  { type: "image", name: "Art 15", src: "images/creator/art-15.webp", ar: 1.167, size: "land" },
  { type: "image", name: "Art 05", src: "images/creator/art-05.webp", ar: 1 },
  { type: "image", name: "Art 06", src: "images/creator/art-06.webp", ar: 1 },
  { type: "image", name: "Art 07", src: "images/creator/art-07.webp", ar: 1 },
  { type: "image", name: "Art 08", src: "images/creator/art-08.webp", ar: 1 },
  { type: "video", name: "Animation 02", src: "images/creator/vid-02.mp4", poster: "images/creator/vid-02.webp", ar: 1, size: "big" },
  { type: "image", name: "Art 09", src: "images/creator/art-09.webp", ar: 1 },
  { type: "image", name: "Art 10", src: "images/creator/art-10.webp", ar: 1 },
  { type: "image", name: "Art 17", src: "images/creator/art-17.webp", ar: 2.734, size: "wide" },
  { type: "video", name: "Animation 03", src: "images/creator/vid-03.mp4", poster: "images/creator/vid-03.webp", ar: 1, size: "big" },
  { type: "image", name: "Art 11", src: "images/creator/art-11.webp", ar: 1 },
  { type: "image", name: "Art 12", src: "images/creator/art-12.webp", ar: 1 },
  { type: "image", name: "Art 16", src: "images/creator/art-16.webp", ar: 1 },
  { type: "image", name: "Art 19", src: "images/creator/art-19.webp", ar: 1 },
  { type: "image", name: "Art 20", src: "images/creator/art-20.webp", ar: 1 },
  { type: "image", name: "Art 21", src: "images/creator/art-21.webp", ar: 1 },
  { type: "video", name: "Animation 04", src: "images/creator/vid-04.mp4", poster: "images/creator/vid-04.webp", ar: 1, size: "big" },
  { type: "image", name: "Art 23", src: "images/creator/art-23.webp", ar: 1 },
  { type: "image", name: "Art 24", src: "images/creator/art-24.webp", ar: 1 }
];

window.SERIES = [
  {
    id: "dandelion",              // used in the web address, no spaces
    title: "Dandelion",
    tagline: "Taken by SujiCorp. Dropped into survival missions against alien creatures.",
    description: "Lyra and Ren are abducted by a shadowy megacorporation and forced into deadly missions. Each episode is a short, fast chapter in a bigger mystery.",
    genres: ["Action", "Romance", "Sci-Fi"],
    colors: ["#ff6de0", "#c66eff", "#6effdb"],
    oneLiner: "Abducted by SujiCorp, Lyra and Ren fight to survive.",
    color: "#ff6de0",
    poster: "images/dandelion-key.webp",
    banner: "images/dandelion-banner.webp",
    bannerPos: "50% 50%",
    bannerPosM: "16% 50%",
    textPos: "right",
    episodes: [
      { title: "Episode 1",  video: "https://vz-30b87a01-407.b-cdn.net/802bcebb-a309-4cce-a95f-73666973e59a/playlist.m3u8", thumb: "images/dandelion-ep01.webp", length: "" },
      { title: "Episode 2",  video: "https://vz-30b87a01-407.b-cdn.net/c52b9dd1-4db0-4c05-a170-56b0412a932e/playlist.m3u8", thumb: "images/dandelion-ep02.webp", length: "" },
      { title: "Episode 3",  video: "https://vz-30b87a01-407.b-cdn.net/a0021643-3c15-4aa9-869b-b548245a1a03/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/a0021643-3c15-4aa9-869b-b548245a1a03/thumbnail.jpg", length: "" },
      { title: "Episode 4",  video: "https://vz-30b87a01-407.b-cdn.net/361b457a-5094-41f6-92dd-2f4b2e72db1d/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/361b457a-5094-41f6-92dd-2f4b2e72db1d/thumbnail.jpg", length: "" },
      { title: "Episode 5",  video: "https://vz-30b87a01-407.b-cdn.net/95d4c7ae-fb0e-4c7f-b7ab-0b125eab8e7b/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/95d4c7ae-fb0e-4c7f-b7ab-0b125eab8e7b/thumbnail.jpg", length: "" },
      { title: "Episode 6",  video: "https://vz-30b87a01-407.b-cdn.net/afc202fc-d662-4a42-b76f-7b356fd2c03d/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/afc202fc-d662-4a42-b76f-7b356fd2c03d/thumbnail.jpg", length: "" },
      { title: "Episode 7",  video: "https://vz-30b87a01-407.b-cdn.net/5c77d094-73bb-43b6-bb01-e0e557122ca5/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/5c77d094-73bb-43b6-bb01-e0e557122ca5/thumbnail.jpg", length: "" },
      { title: "Episode 8",  video: "https://vz-30b87a01-407.b-cdn.net/5658a9fd-b3a5-4a2d-8240-e44d6981730c/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/5658a9fd-b3a5-4a2d-8240-e44d6981730c/thumbnail.jpg", length: "" },
      { title: "Episode 9",  video: "https://vz-30b87a01-407.b-cdn.net/7afc8bd4-4a7e-42e1-bb60-d2e161d0b3ad/playlist.m3u8", thumb: "https://vz-30b87a01-407.b-cdn.net/7afc8bd4-4a7e-42e1-bb60-d2e161d0b3ad/thumbnail.jpg", length: "" },
      { title: "Episode 10", video: "https://vz-30b87a01-407.b-cdn.net/e201ec84-bfca-4a81-8154-0bc3ee8825b2/playlist.m3u8", thumb: "images/dandelion-ep10.webp", length: "" }
    ]
  },
  {
    id: "shiba-express",
    title: "Shiba Express",
    tagline: "Cyborgs fighting to survive in the post-apocalyptic world of Tensei.",
    description: "A short-form action series set in Tensei, after the end of the old world.",
    genres: ["Action", "Sci-Fi"],
    colors: ["#6effdb", "#c66eff", "#ff6de0"],
    oneLiner: "Cyborgs fighting to survive in the post-apocalyptic world of Tensei.",
    color: "#6effdb",
    poster: "images/shiba-poster.webp",
    banner: "images/shiba-poster.webp",
    bannerPos: "50% 16%",
    bannerPosM: "50% 15%",
    episodes: [
      { title: "Episode 1", video: "", thumb: "images/shiba-ep01.webp", length: "" },
      { title: "Episode 2", video: "", thumb: "", length: "" },
      { title: "Episode 3", video: "", thumb: "", length: "" },
      { title: "Episode 4", video: "", thumb: "images/shiba-ep04.webp", length: "" },
      { title: "Episode 5", video: "", thumb: "images/shiba-ep05.webp", length: "" },
      { title: "Episode 6", video: "", thumb: "images/shiba-ep06.webp", length: "" }
    ]
  },
  {
    id: "doomsday-baddie",
    title: "Doomsday Baddie",
    tagline: "Reborn as a Doomsday Baddie.",
    description: "Write a short description of the series here.",
    genres: ["Action"],
    colors: ["#ffe76e", "#ff6de0", "#c66eff"],
    oneLiner: "Reborn as a doomsday baddie.",
    color: "#c66eff",
    poster: "images/doomsday-poster.webp",
    banner: "images/doomsday-banner.webp",
    bannerPos: "50% 19%",
    bannerPosM: "50% 12%",
    bannerZoomM: 1.3,
    textPos: "right",
    episodes: [
      { title: "Episode 1", video: "", thumb: "", length: "" },
      { title: "Episode 2", video: "", thumb: "", length: "" },
      { title: "Episode 3", video: "", thumb: "", length: "" }
    ]
  }
];
