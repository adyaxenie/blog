export type ProjectStatus = "Live" | "Building" | "Paused" | "Failed";

export interface HomepageProject {
  name: string;
  status: ProjectStatus;
  url: string;
}

export const homepageProjects: HomepageProject[] = [
  { name: "dailyglowup.app", status: "Live", url: "https://dailyglowup.app" },
  { name: "rltcg.com", status: "Failed", url: "https://rltcg.com" },
  { name: "pdfdino.com", status: "Live", url: "https://pdfdino.com" },
  { name: "supbot.io", status: "Failed", url: "https://supbot.io" },
];
