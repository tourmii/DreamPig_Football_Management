// Centralized API client for DreamPig Football — Supabase Edition
import { supabase } from './supabase.js';

export const api = {
    // ========== PLAYERS ==========

    async getPlayers() {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('name');
        if (error) throw new Error(error.message);
        return data;
    },

    async getPlayer(id) {
        const { data: player, error } = await supabase
            .from('players')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw new Error(error.message);

        const { data: history } = await supabase
            .from('evaluations')
            .select('*, matches(title, date, time, location)')
            .eq('player_id', id)
            .order('created_at', { ascending: false });

        return {
            ...player,
            history: (history || []).map((h) => ({
                ...h,
                title: h.matches?.title,
                date: h.matches?.date,
                time: h.matches?.time,
                location: h.matches?.location,
            })),
        };
    },

    async createPlayer(data) {
        const { data: player, error } = await supabase
            .from('players')
            .insert(data)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return player;
    },

    async updatePlayer(id, data) {
        const { data: player, error } = await supabase
            .from('players')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return player;
    },

    async deletePlayer(id) {
        const { error } = await supabase.from('players').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { success: true };
    },

    // ========== MATCHES ==========

    async getMatches() {
        const { data, error } = await supabase
            .from('matches')
            .select('*, match_players(count)')
            .order('date', { ascending: false });
        if (error) throw new Error(error.message);

        return data.map((m) => ({
            ...m,
            player_count: m.match_players?.[0]?.count || 0,
        }));
    },

    async getMatch(id) {
        const { data: match, error } = await supabase
            .from('matches')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw new Error(error.message);

        const { data: players } = await supabase
            .from('match_players')
            .select('*, players(name, position, rating, passing, shooting, defending, dribbling, stamina, avg_score)')
            .eq('match_id', id)
            .order('player_id');

        const { data: evaluations } = await supabase
            .from('evaluations')
            .select('*, players(name)')
            .eq('match_id', id);

        const { data: payments } = await supabase
            .from('payments')
            .select('*, players(name)')
            .eq('match_id', id);

        return {
            ...match,
            players: (players || []).map((mp) => ({
                ...mp,
                name: mp.players?.name,
                position: mp.players?.position,
                rating: mp.players?.rating,
                passing: mp.players?.passing,
                shooting: mp.players?.shooting,
                defending: mp.players?.defending,
                dribbling: mp.players?.dribbling,
                stamina: mp.players?.stamina,
                avg_score: mp.players?.avg_score,
            })),
            evaluations: (evaluations || []).map((e) => ({ ...e, name: e.players?.name })),
            payments: (payments || []).map((p) => ({ ...p, name: p.players?.name })),
        };
    },

    async createMatch(data) {
        const { data: match, error } = await supabase
            .from('matches')
            .insert(data)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return match;
    },

    async updateMatch(id, data) {
        const { data: match, error } = await supabase
            .from('matches')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return match;
    },

    async deleteMatch(id) {
        const { error } = await supabase.from('matches').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { success: true };
    },

    async registerPlayers(matchId, playerIds) {
        const rows = playerIds.map((pid) => ({ match_id: matchId, player_id: pid, available: true }));
        const paymentRows = playerIds.map((pid) => ({ match_id: matchId, player_id: pid, paid: false }));

        const { error: e1 } = await supabase.from('match_players').upsert(rows, { onConflict: 'match_id,player_id' });
        if (e1) throw new Error(e1.message);

        const { error: e2 } = await supabase.from('payments').upsert(paymentRows, { onConflict: 'match_id,player_id' });
        if (e2) throw new Error(e2.message);

        return { success: true };
    },

    async removePlayer(matchId, playerId) {
        await supabase.from('match_players').delete().eq('match_id', matchId).eq('player_id', playerId);
        await supabase.from('payments').delete().eq('match_id', matchId).eq('player_id', playerId);
        return { success: true };
    },

    async completeMatch(matchId) {
        const { data, error } = await supabase
            .from('matches')
            .update({ status: 'completed' })
            .eq('id', matchId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    // ========== TEAMS ==========

    async generateTeams(matchId) {
        // Fetch registered players with their stats
        const { data: matchPlayers, error } = await supabase
            .from('match_players')
            .select('*, players(name, position, rating, passing, shooting, defending, dribbling, stamina, avg_score)')
            .eq('match_id', matchId)
            .eq('available', true);
        if (error) throw new Error(error.message);

        const players = (matchPlayers || []).map((mp) => ({
            ...mp,
            name: mp.players?.name,
            position: mp.players?.position,
            rating: mp.players?.rating,
            passing: mp.players?.passing,
            shooting: mp.players?.shooting,
            defending: mp.players?.defending,
            dribbling: mp.players?.dribbling,
            stamina: mp.players?.stamina,
            avg_score: mp.players?.avg_score,
        }));

        if (players.length < 2) throw new Error('Need at least 2 players to form teams');

        const scenarios = generateBalancedTeams(players);
        return { scenarios, playerCount: players.length };
    },

    async saveTeams(matchId, teamA, teamB) {
        // Clear existing
        await supabase.from('match_players').update({ team: null }).eq('match_id', matchId);

        // Set team A
        for (const pid of teamA) {
            await supabase.from('match_players').update({ team: 'A' }).eq('match_id', matchId).eq('player_id', pid);
        }
        // Set team B
        for (const pid of teamB) {
            await supabase.from('match_players').update({ team: 'B' }).eq('match_id', matchId).eq('player_id', pid);
        }

        // Save to match record
        await supabase
            .from('matches')
            .update({ team_a_json: teamA, team_b_json: teamB })
            .eq('id', matchId);

        return { success: true };
    },

    // ========== EVALUATIONS ==========

    async submitEvaluations(matchId, evaluations) {
        const rows = evaluations.map((ev) => ({
            match_id: matchId,
            player_id: ev.player_id,
            passing: ev.passing,
            shooting: ev.shooting,
            defending: ev.defending,
            dribbling: ev.dribbling,
            stamina: ev.stamina,
            overall_score: +((ev.passing + ev.shooting + ev.defending + ev.dribbling + ev.stamina) / 5).toFixed(2),
        }));

        const { error } = await supabase
            .from('evaluations')
            .upsert(rows, { onConflict: 'match_id,player_id' });
        if (error) throw new Error(error.message);

        // Update each player's average score
        for (const ev of evaluations) {
            const { data: allEvals } = await supabase
                .from('evaluations')
                .select('overall_score')
                .eq('player_id', ev.player_id);

            if (allEvals && allEvals.length > 0) {
                const avg = allEvals.reduce((s, e) => s + e.overall_score, 0) / allEvals.length;
                await supabase
                    .from('players')
                    .update({ avg_score: +avg.toFixed(2), matches_played: allEvals.length })
                    .eq('id', ev.player_id);
            }
        }

        // Mark match as completed
        await supabase.from('matches').update({ status: 'completed' }).eq('id', matchId);

        return { success: true };
    },

    async getEvaluations(matchId) {
        const { data, error } = await supabase
            .from('evaluations')
            .select('*, players(name, position)')
            .eq('match_id', matchId)
            .order('overall_score', { ascending: false });
        if (error) throw new Error(error.message);
        return (data || []).map((e) => ({ ...e, name: e.players?.name, position: e.players?.position }));
    },

    // ========== PAYMENTS ==========

    async getPayments(matchId) {
        const { data: payments, error } = await supabase
            .from('payments')
            .select('*, players(name)')
            .eq('match_id', matchId)
            .order('player_id');
        if (error) throw new Error(error.message);

        const { data: match } = await supabase
            .from('matches')
            .select('qr_image_path, fee')
            .eq('id', matchId)
            .single();

        return {
            payments: (payments || []).map((p) => ({ ...p, name: p.players?.name })),
            qr_image_path: match?.qr_image_path,
            fee: match?.fee,
        };
    },

    async updatePayments(matchId, payments) {
        for (const p of payments) {
            await supabase
                .from('payments')
                .update({ paid: p.paid })
                .eq('match_id', matchId)
                .eq('player_id', p.player_id);
        }
        return { success: true };
    },

    async uploadQR(matchId, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `qr_match_${matchId}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('qr-codes')
            .upload(fileName, file, { upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage.from('qr-codes').getPublicUrl(fileName);
        const qrPath = urlData.publicUrl;

        await supabase.from('matches').update({ qr_image_path: qrPath }).eq('id', matchId);

        return { qr_image_path: qrPath };
    },
};

// ========== TEAM BALANCING ALGORITHM (client-side) ==========

function generateBalancedTeams(players) {
    const positionPriority = { Goalkeeper: 0, Defender: 1, Midfielder: 2, Forward: 3 };

    const scored = players.map((p) => ({
        ...p,
        compositeScore: (p.rating * 2 + p.passing + p.shooting + p.defending + p.dribbling + p.stamina) / 7,
        posPriority: positionPriority[p.position] ?? 2,
    }));

    const scenarios = [];

    // Scenario 1: Snake draft by rating
    scenarios.push(snakeDraft([...scored], 'rating', 'Balanced by Rating'));

    // Scenario 2: Snake draft by composite score
    scenarios.push(snakeDraft([...scored], 'compositeScore', 'Balanced by Skill'));

    // Scenario 3: Position-balanced draft
    scenarios.push(positionBalancedDraft([...scored]));

    // Deduplicate
    const unique = [];
    const seen = new Set();
    for (const s of scenarios) {
        const key = s.teamA.map((p) => p.player_id).sort().join(',');
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(s);
        }
    }
    return unique;
}

function snakeDraft(players, sortKey, name) {
    players.sort((a, b) => b[sortKey] - a[sortKey]);
    const teamA = [], teamB = [];

    for (let i = 0; i < players.length; i++) {
        const round = Math.floor(i / 2);
        if (i % 2 === 0) {
            (round % 2 === 0 ? teamA : teamB).push(players[i]);
        } else {
            (round % 2 === 0 ? teamB : teamA).push(players[i]);
        }
    }

    return {
        name,
        teamA,
        teamB,
        teamAScore: calcTeamScore(teamA),
        teamBScore: calcTeamScore(teamB),
        diff: Math.abs(calcTeamScore(teamA) - calcTeamScore(teamB)).toFixed(2),
    };
}

function positionBalancedDraft(players) {
    const byPosition = {};
    for (const p of players) {
        if (!byPosition[p.position]) byPosition[p.position] = [];
        byPosition[p.position].push(p);
    }

    const teamA = [], teamB = [];
    for (const pos of ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']) {
        const group = (byPosition[pos] || []).sort((a, b) => b.rating - a.rating);
        for (let i = 0; i < group.length; i++) {
            (i % 2 === 0 ? teamA : teamB).push(group[i]);
        }
    }

    return {
        name: 'Position Balanced',
        teamA,
        teamB,
        teamAScore: calcTeamScore(teamA),
        teamBScore: calcTeamScore(teamB),
        diff: Math.abs(calcTeamScore(teamA) - calcTeamScore(teamB)).toFixed(2),
    };
}

function calcTeamScore(team) {
    if (team.length === 0) return 0;
    return +(team.reduce((sum, p) => sum + p.compositeScore, 0) / team.length).toFixed(2);
}
