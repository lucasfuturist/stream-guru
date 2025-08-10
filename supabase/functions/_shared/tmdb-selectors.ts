// Shared helpers to choose a "best" certification and map cast/crew.
export const COUNTRY_PRIORITY = ["US", "GB", "CA", "AU"];
export const TYPE_PRIORITY = [3, 4, 5, 1, 2, 6, 7]; // theatrical > digital > physical > premiere > TV > others

export function pickMovieCertification(releaseDatesPayload: any) {
  const blocks: any[] = releaseDatesPayload?.results ?? [];
  for (const c of COUNTRY_PRIORITY) {
    const block = blocks.find(b => b.iso_3166_1 === c);
    if (!block) continue;
    const rds = (block.release_dates ?? [])
      .filter((r: any) => (r.certification ?? "").trim().length > 0)
      .sort((a: any, b: any) =>
        TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type));
    if (rds.length) {
      return { country: c, rating: rds[0].certification, chosen: rds[0], source: "movie:release_dates" };
    }
  }
  return null;
}

export function pickTvRating(contentRatingsPayload: any) {
  const blocks: any[] = contentRatingsPayload?.results ?? [];
  for (const c of COUNTRY_PRIORITY) {
    const b = blocks.find(x => x.iso_3166_1 === c && (x.rating ?? "").trim().length > 0);
    if (b) return { country: c, rating: b.rating, chosen: b, source: "tv:content_ratings" };
  }
  return null;
}

export function mapTopCast(credits: any, max = 10) {
  const cast = (credits?.cast ?? []).slice(0, max).map((p: any) => ({
    name: p.name, character: p.character, profile_path: p.profile_path
  }));
  const director = (credits?.crew ?? []).find((c: any) => c.job === "Director")?.name ?? null;
  return { top_cast: cast, director };
}
