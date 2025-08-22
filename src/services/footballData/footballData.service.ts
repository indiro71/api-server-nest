import { HttpService, Injectable } from '@nestjs/common';

@Injectable()
export class FootballDataService {
  constructor(private httpService: HttpService) {}

  private readonly baseUrl = 'https://api.football-data.org/v4';
  private readonly headers = {
    'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY,
    'Content-Type': 'application/json',
  };

  private readonly topTeams: Record<number, string> = {
    4: 'Borussia Dortmund',
    5: 'Bayern Munich',
    64: 'Liverpool',
    65: 'Manchester City',
    66: 'Manchester United',
    78: 'Atlético Madrid',
    81: 'Barcelona',
    86: 'Real Madrid',
    98: 'Milan',
    108: 'Internazionale',
    109: 'Juventus',
    524: 'PSG'
  };

  async getMatchesByDate(
      dateFrom: string,
      dateTo: string,
      competitions = 'PL,CL,EC,FL1,BL1,SA,PD',
  ) {
    const url = `${this.baseUrl}/matches?competitions=${competitions}&dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const response = await this.httpService.get(url, { headers: this.headers }).toPromise();

    return response.data.matches.map((m) => ({
      utcDate: m.utcDate,
      status: m.status,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
      competition: m.competition.name,
    }));
  }

  async getTodayMatches() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    return this.getMatchesByDate(today, tomorrowDate);
  }

  async matches() {
    const matches = await this.getTodayMatches();
    if (!matches.length) {
      return 'Сегодня игр нет ⚽️';
    }

    const grouped: Record<string, typeof matches> = {};
    matches.forEach((m) => {
      if (!grouped[m.competition]) grouped[m.competition] = [];
      grouped[m.competition].push(m);
    });

    let text = '⚽️ *Матчи сегодня*\n\n';
    for (const [competition, games] of Object.entries(grouped)) {
      text += `🏆 *${competition}*\n`;
      games.forEach((m) => {
        const time = new Date(m.utcDate).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        });
        text += `⏰ ${time} — ${m.homeTeam} vs ${m.awayTeam}\n`;
      });
      text += '\n';
    }

    return text;
  }

  async topMatches() {
    const matches = await this.getTodayMatches();
    const topMatches = matches.filter(
        (m) =>
            this.topTeams[m.homeTeamId] && this.topTeams[m.awayTeamId],
    );

    if (!topMatches.length) {
      return 'Сегодня топовых матчей нет 🔥';
    }

    let text = '🔥 *Топ-матчи сегодня*\n\n';
    topMatches.forEach((m) => {
      const time = new Date(m.utcDate).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      text += `⏰ ${time} — ${m.homeTeam} vs ${m.awayTeam} (${m.competition})\n`;
    });

    return text;
  }
}
