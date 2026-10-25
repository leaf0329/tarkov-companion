export interface ContributorApiItem {
  avatar: string;
  contributions: number;
  login: string;
  url: string;
}
export interface ContributorsResponse {
  error?: string;
  items: ContributorApiItem[];
}
