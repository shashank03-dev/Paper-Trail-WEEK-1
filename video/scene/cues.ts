/** The shape of video/cues.json and the voiceover's lines.json. */

export interface Beats {
  land: number;
  pin: number;
  route: number;
  print: number;
  lift: number;
  fold: number;
  phoneOut: number;
  phoneStamp: number;
  closeup: number;
  ticks: number[];
  photo: number;
  shutter: number;
  markers: number[];
  flatten: number;
  read: number;
  report: number;
  postmark: number;
  end: number;
}

export interface Cues {
  hold: number;
  vo: { line: number; at: number }[];
  beats: Beats;
}

export interface VoLines {
  lines: {
    line: number;
    text: string;
    dur: number;
    words: { w: string; s: number; e: number }[];
  }[];
}
