/**
 * Seed the Meridian Ledger newsroom with realistic demo data.
 * Run with: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DAY = 86_400_000;
const now = Date.now();
const inDays = (n: number) => new Date(now + n * DAY);
const agoDays = (n: number) => new Date(now - n * DAY);

function ago(n: number): Date {
  return new Date(now - n * DAY);
}

async function main() {
  console.log("Seeding newsroom data…");

  await db.handoff.deleteMany();
  await db.payloadSnapshot.deleteMany();
  await db.storyMedia.deleteMany();
  await db.mediaAsset.deleteMany();
  await db.story.deleteMany();

  // ---------------------------------------------------------------------
  // Media vault
  // ---------------------------------------------------------------------
  const assets = await Promise.all(
    [
      {
        fileName: "council-chamber.png",
        title: "Metro Council in session before the housing vote",
        description:
          "Wide view of the council chamber during the final reading of the housing package, taken from the public gallery.",
        photographer: "Dana Whitfield",
        source: "Meridian Ledger Staff",
        licenseType: "Staff Original",
        licenseNotes:
          "Original staff photography. Unrestricted internal use across all Meridian Ledger channels.",
        allowedChannels: ["web", "print", "social", "broadcast"],
        expiresAt: null,
        creditRequired: true,
        creditLine: "Dana Whitfield / The Meridian Ledger",
        width: 1344,
        height: 768,
        sizeKb: 187,
        createdAt: ago(2),
      },
      {
        fileName: "city-hall-exterior.png",
        title: "City Hall at dusk before budget session",
        description:
          "Exterior of the City Hall clock tower with flags, shot at dusk ahead of the spring budget session.",
        photographer: "Aja Okafor",
        source: "Meridian Picture Desk",
        licenseType: "Rights-Managed",
        licenseNotes:
          "Rights-managed through the regional picture agency. Web channel only; no sublicensing to partners.",
        allowedChannels: ["web"],
        expiresAt: inDays(200),
        creditRequired: true,
        creditLine: "Aja Okafor / Meridian Picture Desk",
        width: 1344,
        height: 768,
        sizeKb: 184,
        createdAt: ago(3),
      },
      {
        fileName: "port-cranes.png",
        title: "Super-post-panamax cranes loading at first light",
        description:
          "Gantry cranes working the north berth at sunrise as the port set its monthly throughput record.",
        photographer: "Jonas Reinholt",
        source: "Meridian Ledger Staff",
        licenseType: "Staff Original",
        licenseNotes:
          "Original staff photography. Cleared for all Meridian Ledger channels in perpetuity.",
        allowedChannels: ["web", "print", "social", "broadcast"],
        expiresAt: null,
        creditRequired: true,
        creditLine: "Jonas Reinholt / The Meridian Ledger",
        width: 1344,
        height: 768,
        sizeKb: 163,
        createdAt: ago(1),
      },
      {
        fileName: "press-conference.png",
        title: "Podium microphones at the mayor's budget briefing",
        description:
          "Cluster of network microphones on the briefing-room podium before the mayor's budget address.",
        photographer: "Wire Service Photo",
        source: "Continental Wire Images",
        licenseType: "Editorial Use Only",
        licenseNotes:
          "Wire service handout. Editorial use only, no commercial or promotional use. Must not crop out agency watermark.",
        allowedChannels: ["web"],
        expiresAt: inDays(12),
        creditRequired: true,
        creditLine: "Continental Wire Images",
        width: 1344,
        height: 768,
        sizeKb: 93,
        createdAt: ago(5),
      },
      {
        fileName: "data-center-servers.png",
        title: "Server aisle inside the Harborview data center",
        description:
          "One-point perspective down a lit server aisle at the Harborview hyperscale campus.",
        photographer: "Miguel Andrade",
        source: "Andrade Visuals (Agency)",
        licenseType: "Rights-Managed",
        licenseNotes:
          "Rights-managed agency license secured for a 12-month web-only window. License term has lapsed; renewal quote pending.",
        allowedChannels: ["web"],
        expiresAt: agoDays(10), // EXPIRED
        creditRequired: true,
        creditLine: "Miguel Andrade / Andrade Visuals",
        width: 1344,
        height: 768,
        sizeKb: 177,
        createdAt: ago(26),
      },
      {
        fileName: "data-center-exterior.png",
        title: "Harborview campus exterior at dusk",
        description:
          "Long white data-hall buildings and cooling plant behind the security fence at dusk.",
        photographer: "Dana Whitfield",
        source: "Meridian Ledger Staff",
        licenseType: "Staff Original",
        licenseNotes:
          "Original staff photography shot on assignment. Cleared for all Meridian Ledger channels.",
        allowedChannels: ["web", "print", "social"],
        expiresAt: null,
        creditRequired: true,
        creditLine: "Dana Whitfield / The Meridian Ledger",
        width: 1344,
        height: 768,
        sizeKb: 167,
        createdAt: ago(4),
      },
      {
        fileName: "flood-street.png",
        title: "Storm surge flooding on Beachmont Avenue",
        description:
          "Floodwater reaching car doors on Beachmont Avenue after the overnight surge, residents waiting to inspect damage.",
        photographer: "Ruth Kowalczyk",
        source: "Freelance Contributor",
        licenseType: "Editorial Use Only",
        licenseNotes:
          "Freelance assignment. One-time editorial use per outlet; social use permitted only with credit in image caption.",
        allowedChannels: ["web", "social"],
        expiresAt: inDays(90),
        creditRequired: true,
        creditLine: "Ruth Kowalczyk for The Meridian Ledger",
        width: 1344,
        height: 768,
        sizeKb: 146,
        createdAt: ago(6),
      },
      {
        fileName: "trading-floor.png",
        title: "Regional exchange floor during the afternoon rally",
        description:
          "Traders at their stations as the board shows the afternoon rally in rate-sensitive shares.",
        photographer: "Wire Service Photo",
        source: "Continental Wire Images",
        licenseType: "Rights-Managed",
        licenseNotes:
          "Agency license for markets coverage. Web channel only. Do not use in advertiser-sponsored content.",
        allowedChannels: ["web"],
        expiresAt: inDays(45),
        creditRequired: true,
        creditLine: "Continental Wire Images",
        width: 1344,
        height: 768,
        sizeKb: 155,
        createdAt: ago(2),
      },
      {
        fileName: "stadium-night.png",
        title: "Harbor Park under lights before the derby",
        description:
          "General view of Harbor Park during the pre-match light show ahead of the title decider.",
        photographer: "Camille Fournier",
        source: "Meridian Ledger Staff",
        licenseType: "Staff Original",
        licenseNotes:
          "Original staff photography. Cleared for all channels including broadcast bumpers.",
        allowedChannels: ["web", "print", "social", "broadcast"],
        expiresAt: null,
        creditRequired: true,
        creditLine: "Camille Fournier / The Meridian Ledger",
        width: 1344,
        height: 768,
        sizeKb: 188,
        createdAt: ago(2),
      },
      {
        fileName: "solar-aerial.png",
        title: "Aerial view of the Cedar Flats solar array",
        description:
          "Drone view of panel rows at Cedar Flats, the utility-scale array at the center of the tariff dispute.",
        photographer: "Lena Brandt",
        source: "Brandt Aerial (Agency)",
        licenseType: "Rights-Managed",
        licenseNotes:
          "Rights-managed aerial license. Annual renewal required; license lapsed and renewal not yet invoiced.",
        allowedChannels: ["web", "print"],
        expiresAt: agoDays(60), // EXPIRED
        creditRequired: true,
        creditLine: "Lena Brandt / Brandt Aerial",
        width: 1344,
        height: 768,
        sizeKb: 232,
        createdAt: ago(70),
      },
      {
        fileName: "solar-rooftop.png",
        title: "Crew installing rooftop panels in Maple Grove",
        description:
          "Installation crew setting residential rooftop panels under the new community-solar program.",
        photographer: "Theo Marchetti",
        source: "Meridian Ledger Staff",
        licenseType: "Creative Commons BY",
        licenseNotes:
          "Released under CC BY 4.0 by the photo desk. Attribution required; derivatives permitted.",
        allowedChannels: ["web", "print", "social", "broadcast"],
        expiresAt: null,
        creditRequired: true,
        creditLine: "Theo Marchetti / The Meridian Ledger (CC BY 4.0)",
        width: 1344,
        height: 768,
        sizeKb: 160,
        createdAt: ago(8),
      },
      {
        fileName: "mural-restoration.png",
        title: "Conservator at work on the WPA-era mural",
        description:
          "Lead conservator Ingrid Soto retouching the 1938 mural from the scaffold during final conservation.",
        photographer: "Museum Press Office",
        source: "Meridian Museum of Art (Handout)",
        licenseType: "Editorial Use Only",
        licenseNotes:
          "Institutional handout. One-time editorial use in connection with the reopening; must retain museum caption text.",
        allowedChannels: ["web", "print"],
        expiresAt: inDays(120),
        creditRequired: true,
        creditLine: "Courtesy Meridian Museum of Art",
        width: 1344,
        height: 768,
        sizeKb: 117,
        createdAt: ago(7),
      },
      {
        fileName: "transit-hub.png",
        title: "Morning service at Central light-rail interchange",
        description:
          "A Line 2 tram arriving at the Central interchange as commuters board for the morning peak.",
        photographer: "Jonas Reinholt",
        source: "Meridian Ledger Staff",
        licenseType: "Staff Original",
        licenseNotes:
          "Original staff photography. Cleared for all Meridian Ledger channels in perpetuity.",
        allowedChannels: ["web", "print", "social", "broadcast"],
        expiresAt: null,
        creditRequired: true,
        creditLine: "Jonas Reinholt / The Meridian Ledger",
        width: 1344,
        height: 768,
        sizeKb: 158,
        createdAt: ago(9),
      },
    ].map((a) =>
      db.mediaAsset.create({
        data: { ...a, allowedChannels: JSON.stringify(a.allowedChannels) },
      })
    )
  );

  const byFile = Object.fromEntries(assets.map((a) => [a.fileName, a.id]));

  // ---------------------------------------------------------------------
  // Stories
  // ---------------------------------------------------------------------
  const storySeed = [
    {
      slug: "metro-council-housing-package",
      title: "Metro Council Approves Landmark Housing Package After Marathon Session",
      summary:
        "The 11-2 vote caps eight months of negotiation and unlocks $1.4 billion for mixed-income development across four council districts, with the first groundbreakings expected next spring.",
      scheduledFor: inDays(1),
      body: `The Metro Council voted 11-2 shortly before midnight Tuesday to approve the most expansive housing package in the city's history, ending eight months of stops, starts and closed-door mediation between developers, tenant groups and neighborhood associations.

The ordinance authorizes $1.4 billion in mixed-income development bonds, rezones industrial land along the eastern rail corridor for residential use, and creates a permanence fund that will subsidize roughly 6,200 affordable units over the next decade. Mayor Corinne Vasquez, who staked significant political capital on the bill, called the vote "the night this council chose building over blocking."

Opposition centered on parking minimums and height allowances near single-family blocks in the city's southwest quadrant. Council member Albert Reyes, one of two dissenting votes, warned that the corridor rezoning "outsizes anything this body has ever approved without a master plan."

Implementation now shifts to the planning department, which must publish detailed corridor guidelines within 90 days. Housing advocates, who packed the gallery in orange vests, greeted the result with a sustained standing ovation — then turned to the harder work of monitoring what gets built, and for whom.`,
      desk: "City Hall",
      author: "Priya Raman",
      assignee: "Marcus Bell",
      status: "APPROVED",
      priority: "HIGH",
      media: [
        { file: "council-chamber.png", isPrimary: true, caption: "Council members debate the final reading of the housing package on Tuesday night.", altText: "Council members seated at a semicircular dais debate during a night session of the Metro Council." },
        { file: "city-hall-exterior.png", isPrimary: false, caption: "City Hall, where the housing package passed 11-2 after an eight-month negotiation.", altText: "The stone facade and clock tower of City Hall photographed from across the plaza." },
      ],
    },
    {
      slug: "port-throughput-record",
      title: "Port Throughput Hits Record as New Super-Post-Panamax Cranes Come Online",
      summary:
        "March container volume reached 412,000 TEU, up 14 percent year over year, as three new ship-to-shore cranes cut average berth time to under 36 hours.",
      scheduledFor: inDays(2),
      body: `The Port of Meridian handled 412,000 twenty-foot containers last month, the busiest month in its 92-year history, according to preliminary figures released Monday by the harbor authority.

Port officials attribute the surge to three super-post-panamax ship-to-shore cranes commissioned in January, which cut average vessel turnaround from 52 hours to just under 36. The cranes, among the tallest on the western seaboard, can work vessels 22 containers wide — a class the channel dredging project was designed to attract.

Export volume grew even faster than imports, up 19 percent, driven by agricultural machinery and refrigerated produce. Terminal operator Northgate Marine said it will add 120 union jobs by summer to handle the expanded schedule.

Harbor authority director Elena Ruiz cautioned that sustained growth depends on the long-delayed intermodal rail link, now scheduled for a 2027 groundbreaking. "Cranes don't move boxes to the customer," Ruiz said. "The rail link is the whole game."`,
      desk: "Business",
      author: "Elias Vance",
      assignee: "Ines Duarte",
      status: "APPROVED",
      priority: "NORMAL",
      media: [
        { file: "port-cranes.png", isPrimary: true, caption: "New ship-to-shore cranes work a container vessel at the north berth at sunrise.", altText: "Tall white ship-to-shore cranes lifting shipping containers from a docked vessel at sunrise." },
      ],
    },
    {
      slug: "data-center-boom-suburbs",
      title: "Inside the Data Center Boom Reshaping the Suburbs",
      summary:
        "Cloud providers have quietly assembled 400 acres of server campuses across the county, bringing tax windfalls, constant hum and a zoning fight that is splitting town boards.",
      scheduledFor: inDays(3),
      body: `Drive the county trunk roads at dusk and the newest neighbor is hard to miss: long, white, windowless halls glowing behind security fencing, their cooling stacks exhaling steam into the cold air. Cloud operators have assembled more than 400 acres of data center campuses across the suburban rim in 18 months, county records show.

The projects arrive wrapped in incentives — 20-year tax abatements that cost the school district an estimated $9 million last year — and leave behind modest employment: Harborview's largest hall, 340,000 square feet, employs 45 full-time technicians.

Residents nearest the campuses describe a low, persistent hum that one homeowner compares to "a jet that never lands." Town boards in two townships have placed moratoriums on new approvals while consultants study noise and water use.

Economic development officials counter that the tax base diversification is essential as retail corridors thin. "You don't have to like the hum to do the arithmetic," one commissioner said. The council's first full zoning review is expected next quarter.`,
      desk: "Tech",
      author: "Hana Yoshida",
      assignee: null,
      status: "IN_REVIEW",
      priority: "NORMAL",
      media: [
        { file: "data-center-servers.png", isPrimary: true, caption: "A lit server aisle inside the Harborview hyperscale campus.", altText: "A long corridor of glowing server racks inside a data center hall." },
      ],
    },
    {
      slug: "coastal-towns-dunes-storm-season",
      title: "Coastal Towns Race to Rebuild Dunes Before Storm Season",
      summary:
        "With the first named storms weeks away, three shoreline municipalities are trucking in 200,000 cubic yards of sand and restarting a dormant dispute over who pays.",
      scheduledFor: inDays(5),
      body: `The dump trucks start rolling at 5 a.m. By mid-morning, Beachmont Avenue smells of diesel and wet sand as crews pile the first of 200,000 cubic yards intended to rebuild the dune line before storm season.

Three shoreline municipalities are racing a calendar they cannot control. Federal replenishment money approved after the last major surge will not arrive until late autumn, so the towns are tapping reserves and a shared emergency bond to do interim work.

The effort has revived an old argument over who pays. Inland council members question why road funds should shield a handful of oceanfront blocks, while shore representatives point to the tax revenue the beach season generates.

Engineers say the interim dunes, built with geotextile cores, should absorb a category-one surge. A direct hit from anything stronger would test them severely — and test the towns' fragile cost-sharing truce with it.`,
      desk: "Climate",
      author: "Theo Marchetti",
      assignee: null,
      status: "DRAFT",
      priority: "HIGH",
      media: [],
    },
    {
      slug: "markets-rally-rate-cut-hopes",
      title: "Markets Rally as Rate-Cut Hopes Firm Ahead of Fed Meeting",
      summary:
        "Rate-sensitive shares led a broad advance Monday after fresh payroll data showed cooling wage growth, lifting the regional index to its best session in five weeks.",
      scheduledFor: agoDays(1), // overdue — revision requested
      body: `Equities rallied Monday, with the regional index closing up 1.8 percent for its best session in five weeks, after payroll data showed wage growth cooling faster than economists expected.

Rate-sensitive sectors led the advance. Homebuilders gained 3.4 percent, regional banks 2.7 percent, and utilities — the classic bond proxy — added 2.1 percent as traders raised bets that the central bank will begin easing at next month's meeting.

Strategists cautioned that one payroll report does not make a trend. "The market has been burned before by reading a single month as a turning point," said one fixed-income director. Two-year yields fell 11 basis points.

Volume was heavy into the close, and the volatility index settled back toward its quarterly average. Attention now turns to Wednesday's inflation print, which traders say will either confirm or kill the easing narrative heading into the meeting.`,
      desk: "Business",
      author: "Elias Vance",
      assignee: "Ines Duarte",
      status: "REVISION_REQUESTED",
      priority: "NORMAL",
      media: [
        { file: "trading-floor.png", isPrimary: true, caption: "Traders watch the board during Monday's afternoon rally at the regional exchange.", altText: "Traders on an exchange floor watching a large wall board of rising prices." },
      ],
    },
    {
      slug: "derby-night-title-decider",
      title: "Derby Night: Harbor FC and Union Meet in Title Decider",
      summary:
        "The oldest rivalry in the league doubles as the title decider on Saturday, with Harbor FC needing a draw and Union needing a win to lift the shield.",
      scheduledFor: inDays(4),
      body: `For the first time in league history, the derby is the decider. Harbor FC and Union meet at Harbor Park on Saturday night with the shield on the line: the home side need only a draw, while Union must win to overturn a two-point gap on the final table.

The season split could hardly be more symmetrical — one win apiece, 3-3 on aggregate, and both meetings decided after the 85th minute. Harbor manager Dana Okafor has downplayed the arithmetic. "We're not going to park the bus in front of our own supporters," she said.

Union arrive with the league's top scorer fit again after a hamstring scare, while Harbor will give a late fitness test to captain and defensive anchor Marek Szal. Ticket resale prices crossed $300 midweek.

Police announced an alcohol-free zone around the stadium and extra transit service after last year's post-match congestion. Kickoff is 7:45 p.m., with a sellout crowd expected.`,
      desk: "Sports",
      author: "Marcus Bell",
      assignee: null,
      status: "DRAFT",
      priority: "NORMAL",
      media: [
        { file: "stadium-night.png", isPrimary: true, caption: "Harbor Park under the lights ahead of Saturday's title decider.", altText: "A floodlit soccer stadium bowl at night with the pitch fully visible." },
      ],
    },
    {
      slug: "solar-tariff-ruling-clean-energy",
      title: "Solar Tariff Ruling Clouds Regional Clean-Energy Plans",
      summary:
        "A federal trade ruling doubling import duties on panel components puts three utility-scale projects and a 40-megawatt community program on hold across the region.",
      scheduledFor: inDays(1),
      body: `A federal trade ruling doubling import duties on key panel components has frozen three utility-scale solar projects in the region and forced the utility to reopen financing on its 40-megawatt community program, developers said this week.

The ruling, which imposes the duties on cells that pass through two partner countries, was celebrated by a domestic manufacturing coalition as leveling the field. But regional installers say the math on projects bid two years ago no longer works. "Our contracts have fixed prices. Our inputs just doubled in cost," said the director of one community-solar cooperative.

The county's largest project, the Cedar Flats array, has paused procurement while its developer seeks an exclusion. Utility commissioners estimate the community program's first phase will slip at least two construction seasons.

State energy officials are reviewing whether existing clean-energy fund balances can bridge the gap, but a legislative fix is unlikely before the next session. Installers, meanwhile, report a rush of homeowners trying to lock panel prices before supplier inventories repriced.`,
      desk: "Climate",
      author: "Theo Marchetti",
      assignee: "Dana Whitfield",
      status: "APPROVED",
      priority: "HIGH",
      media: [
        { file: "solar-aerial.png", isPrimary: true, caption: "Panel rows at the Cedar Flats array, where procurement is paused pending a tariff exclusion.", altText: "Aerial view of long parallel rows of dark solar panels across a flat field." },
      ],
    },
    {
      slug: "museum-mural-restoration",
      title: "Museum Unveils Restored WPA-Era Mural After Two-Year Conservation Effort",
      summary:
        "\"River and Rails,\" hidden under decades of varnish and a 1960s overpaint, returns to public view this weekend with 80 percent of its original surface intact.",
      scheduledFor: inDays(6),
      body: `After two years behind scaffolding, "River and Rails" returns to public view this weekend, and curators say the 1938 mural visitors remember as a murky brown hallway is unrecognizable.

Conservators found the work — commissioned under the Works Progress Administration and painted by artist Ruth Calloway — buried under discolored varnish and, at some point in the 1960s, a full overpaint in enamel. Removing it revealed Calloway's original palette: manganese blues, ochre fields, and a factory skyline that later maintenance had simply painted out.

About 80 percent of the original surface survived. Losses along the lower register, where moisture wicked through the plaster, were in-painted using reversible media, a standard the museum says it will document in a published technical study.

The $1.2 million project was funded by a mix of municipal bonds and private grants. Admission to the east wing is free this weekend, and the museum will run conservator-led tours on the hour.`,
      desk: "Culture",
      author: "Ines Duarte",
      assignee: "Priya Raman",
      status: "IN_REVIEW",
      priority: "NORMAL",
      media: [
        { file: "mural-restoration.png", isPrimary: true, caption: "Lead conservator Ingrid Soto retouches the 1938 mural during final conservation.", altText: "A conservator on a scaffold retouching a large colorful mural wall with a fine brush." },
      ],
    },
    {
      slug: "transit-funding-budget-season",
      title: "Transit Funding Takes Center Stage as Budget Season Opens",
      summary:
        "The transit agency is asking for a 22 percent operating increase to restore pre-pandemic service levels, setting up the first real budget fight of the spring session.",
      scheduledFor: agoDays(2),
      body: `Budget season opened Monday with the transit agency's request for a 22 percent operating increase, the largest ask on the table and the first real fight of the spring session.

The agency says it needs the money to restore pre-pandemic service frequency, which ridership analysts call the single biggest factor in the system's slow recovery. Weekend service on three lines still runs at 2019 levels minus a third.

The mayor's office has signaled support but stopped short of endorsing the full figure, pointing to flat sales-tax receipts. Council member Albert Reyes said he would press the agency on Fare evasion losses, estimated at $4 million annually, before any vote.

Public hearings begin next week. Advocacy groups are organizing riders to attend, armed with route-level crowding data obtained through records requests. A council vote is expected by the end of the month.`,
      desk: "City Hall",
      author: "Priya Raman",
      assignee: "Marcus Bell",
      status: "PUBLISHED",
      priority: "NORMAL",
      publishedAt: ago(2),
      media: [
        { file: "transit-hub.png", isPrimary: true, caption: "Morning peak at the Central interchange, where service frequency remains below 2019 levels.", altText: "Commuters crossing a bright transit hall toward the platforms at morning rush hour." },
        { file: "press-conference.png", isPrimary: false, caption: "The mayor's budget briefing podium ahead of the spring session.", altText: "A podium with microphones set in front of a city seal at a press briefing." },
      ],
    },
  ];

  let storyCount = 0;
  const runCounters: Record<string, number> = {};
  for (const s of storySeed) {
    const createdAgo = 9 - storyCount;
    const story = await db.story.create({
      data: {
        slug: s.slug,
        title: s.title,
        summary: s.summary,
        body: s.body,
        desk: s.desk,
        author: s.author,
        assignee: s.assignee,
        status: s.status,
        priority: s.priority,
        scheduledFor: (s as { scheduledFor?: Date }).scheduledFor ?? null,
        publishedAt: (s as { publishedAt?: Date }).publishedAt ?? null,
        // Editorial run order within the status column, following seed order.
        runOrder: (runCounters[s.status] = (runCounters[s.status] ?? 0) + 1),
        createdAt: ago(createdAgo),
      },
    });
    storyCount += 1;

    for (const m of s.media) {
      await db.storyMedia.create({
        data: {
          storyId: story.id,
          mediaId: byFile[m.file],
          isPrimary: m.isPrimary,
          caption: m.caption,
          altText: (m as { altText?: string }).altText ?? null,
        },
      });
    }

    // ---- editorial timeline events (story-scoped audit trail) ----
    type EventRow = { kind: string; message: string; actor: string; daysAgo: number };
    const events: EventRow[] = [
      {
        kind: "CREATED",
        message: `Story created on the ${s.desk} desk as Draft.`,
        actor: s.author,
        daysAgo: createdAgo,
      },
    ];
    if (s.media.length > 0) {
      events.push({
        kind: "MEDIA_ATTACHED",
        message: `Attached ${s.media.length} media asset(s), lead image "${s.media.find((m) => m.isPrimary)?.file.replace(".png", "").replace(/-/g, " ")}".`,
        actor: "Meridian Picture Desk",
        daysAgo: Math.max(createdAgo - 1, 0),
      });
    }
    const statusPath: Record<string, Array<{ status: string; actor: string; daysAgo: number }>> = {
      IN_REVIEW: [{ status: "In Review", actor: s.author, daysAgo: Math.max(createdAgo - 1, 1) }],
      REVISION_REQUESTED: [
        { status: "In Review", actor: s.author, daysAgo: Math.max(createdAgo - 2, 2) },
        { status: "Revision Requested", actor: s.assignee ?? "Desk Editor", daysAgo: Math.max(createdAgo - 1, 1) },
      ],
      APPROVED: [
        { status: "In Review", actor: s.author, daysAgo: Math.max(createdAgo - 2, 2) },
        { status: "Approved", actor: s.assignee ?? "Desk Editor", daysAgo: Math.max(createdAgo - 1, 1) },
      ],
      PUBLISHED: [
        { status: "In Review", actor: s.author, daysAgo: Math.max(createdAgo - 3, 3) },
        { status: "Approved", actor: s.assignee ?? "Desk Editor", daysAgo: Math.max(createdAgo - 2, 2) },
        { status: "Published", actor: "Handoff Engine", daysAgo: 2 },
      ],
    };
    for (const step of statusPath[s.status] ?? []) {
      events.push({
        kind: step.status === "Published" ? "HANDOFF_EXECUTED" : "STATUS_CHANGED",
        message:
          step.status === "Published"
            ? "Web handoff WEB-20250105-8C21 delivered to cms-web."
            : `Status moved to ${step.status}.`,
        actor: step.actor,
        daysAgo: step.daysAgo,
      });
    }
    if ((s as { scheduledFor?: Date }).scheduledFor) {
      events.push({
        kind: "DEADLINE_SET",
        message: `Publish deadline set to ${(s as { scheduledFor: Date }).scheduledFor.toISOString().slice(0, 10)}.`,
        actor: s.assignee ?? s.author,
        daysAgo: Math.max(createdAgo - 1, 0),
      });
    }

    for (const ev of events) {
      await db.storyEvent.create({
        data: {
          storyId: story.id,
          kind: ev.kind,
          message: ev.message,
          actor: ev.actor,
          createdAt: ago(ev.daysAgo),
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // One historical handoff for the already-published story
  // ---------------------------------------------------------------------
  const published = await db.story.findUnique({
    where: { slug: "transit-funding-budget-season" },
  });
  if (published) {
    await db.handoff.create({
      data: {
        handoffRef: "WEB-20250105-8C21",
        storyId: published.id,
        status: "SUCCESS",
        target: "cms-web",
        payload: JSON.stringify({
          handoffType: "web-publish",
          handoffRef: "WEB-20250105-8C21",
          generatedAt: ago(2).toISOString(),
          sourceSystem: "meridian-newsroom/1.0",
          story: {
            id: published.id,
            slug: published.slug,
            headline: published.title,
          },
          note: "Seeded historical handoff record.",
        }),
        issues: "[]",
        createdAt: ago(2),
      },
    });
  }

  console.log(
    `Seeded ${assets.length} media assets, ${storySeed.length} stories, 1 handoff record.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
