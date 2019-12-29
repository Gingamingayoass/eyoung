const Discord = require("discord.js");
const { Client } = require("../haseul.js");

const functions = require("../functions/functions.js");
const colours = require("../functions/colours.js");

const database = require("../db_queries/reps_db.js");
const levelsdb = require("../db_queries/levels_db.js");

exports.msg = async function(message, args) {

    switch (args[0]) {

        case ".rep":

            switch (args[1]) {

                case "status":
                case undefined:
                    message.channel.startTyping();
                    repStatus(message).then(response => {
                        if (response) message.channel.send(response);
                        message.channel.stopTyping();
                    }).catch(error => {
                        console.error(error);
                        message.channel.stopTyping();
                    })
                    break;
                
                default:
                    message.channel.startTyping();
                    rep(message, args.slice(1)).then(response => {
                        if (response) message.channel.send(response);
                        message.channel.stopTyping();
                    }).catch(error => {
                        console.error(error);
                        message.channel.stopTyping();
                    })
                    break;    

            }
            break;

        case ".repboard":
            switch(args[1]) {

                case "global":
                    message.channel.startTyping();
                    repboard(message, false).then(response => {
                        if (response) message.channel.send(response);
                        message.channel.stopTyping();
                    }).catch(error => {
                        console.error(error);
                        message.channel.stopTyping();
                    })
                    break;
                
                case "local":
                default:
                    message.channel.startTyping();
                    repboard(message, true).then(response => {
                        if (response) message.channel.send(response);
                        message.channel.stopTyping();
                    }).catch(error => {
                        console.error(error);
                        message.channel.stopTyping();
                    })
                    break;

            }
            break;

        case ".streaks":
        case ".streak":
            message.channel.startTyping();
            streaks(message).then(response => {
                if (response) message.channel.send(response);
                message.channel.stopTyping();
            }).catch(error => {
                console.error(error);
                message.channel.stopTyping();
            })
            break;

        case ".streakboard":
            switch(args[1]) {

                case "global":
                    message.channel.startTyping();
                    streakboard(message, false).then(response => {
                        if (response) message.channel.send(response);
                        message.channel.stopTyping();
                    }).catch(error => {
                        console.error(error);
                        message.channel.stopTyping();
                    })
                    break;
                
                case "local":
                default:
                    message.channel.startTyping();
                    streakboard(message, true).then(response => {
                        if (response) message.channel.send(response);
                        message.channel.stopTyping();
                    }).catch(error => {
                        console.error(error);
                        message.channel.stopTyping();
                    })
                    break;

            }
            break;

    }

}

async function rep(message, args) {
    
    let { guild, author, createdTimestamp } = message;
    let todayDate = Math.floor(createdTimestamp / 86400000);

    let senderProfile = await database.getRepProfile(author.id);
    if (!senderProfile) {
        await database.setUserReps(author.id, 3);
        senderProfile = await database.getRepProfile(author.id);
    }
    
    if (senderProfile.repsRemaining < 3) {
        let lastRepDate = Math.floor(senderProfile.lastRepTimestamp / 86400000);
        if (lastRepDate < todayDate) {
            await database.setUserReps(author.id, 3);
        } else if (senderProfile.repsRemaining <= 0) {
            let midnightUTC = Math.floor(86400000 * (todayDate + 1));
            let timeFromNow = functions.getDelta(midnightUTC - createdTimestamp, 'hours');
            let fromNowText = "";
            if (timeFromNow.hours) fromNowText += `${timeFromNow.hours}h `;
            if (timeFromNow.minutes) fromNowText += `${timeFromNow.minutes}m `;
            if (timeFromNow.seconds) fromNowText += `${timeFromNow.seconds}s `;
            return `⚠ You have no reps remaining today! Your reps will be replenished in ${fromNowText.trim()}.`; 
        }
    }

    if (args.length < 1) {
        return `⚠ Please provide a user to rep!`;
    }

    let target = args[0];
    let match = target.match(/^<?@?!?(\d{8,})>?$/);
    if (!match) {
        return `⚠ Please provide a valid user to rep!`;
    }

    let userId = match[1];
    if (userId === author.id) {
        return `⚠ You may not rep yourself!`;
    }
    if (userId === Client.user.id) {
        return `⚠ I'm delighted but you cannot rep me!`;
    }

    let recipient = await guild.fetchMember(userId);
    if (!recipient) {
        return `⚠ The user provided is not in this server or does not exist.`;
    }
    if (recipient.user.bot) {
        return `⚠ You may not rep a bot!`;
    }

    let repStreak = await database.getStreak(author.id, recipient.id);
    if (repStreak) {
        let sendingUser = Object.keys(repStreak).find(key => repStreak[key] == author.id);
        let senderLastRep = repStreak[`${sendingUser}LastRep`];
        let lastUserRepDate = Math.floor(senderLastRep / 86400000);
        if (senderLastRep && lastUserRepDate == todayDate) {
            return `⚠ You may not rep the same user twice in one day!`;
        }
    }

    await database.repUser(author.id, recipient.id, createdTimestamp);
    let recipientProfile = await database.getRepProfile(recipient.id);

    let newStreak = await database.updateStreak(author.id, recipient.id, createdTimestamp);
    let xpRand = Math.floor(Math.random() * 500);
    let addXp = Math.round(Math.floor(((-10/(xpRand-500)) + 1) * 100 + (xpRand/10)) * (1 + (newStreak/100)));

    await levelsdb.updateGlobalXp(recipient.id, addXp);
    let recipientXp = await levelsdb.getGlobalXp(recipient.id);

    let d = newStreak > 1 ? 's':'';
    let embed = new Discord.RichEmbed()
        .setAuthor(`Report`, recipient.user.displayAvatarURL)
        .setColor(parseInt(colours.randomHexColour(true), 16))
        .addField(`Rep`, `${recipientProfile.rep} (+1)`, true)
        .addField(`Exp`, `${recipientXp.toLocaleString()} (+${addXp})`, true);
    if (newStreak) embed.addField(`Streak`, `${newStreak} day${d} :fire:`, false);

    message.channel.send(`You gave **${recipient.user.username}** a reputation point and **${addXp}** XP! ${addXp > 1000 ? ':confetti_ball:' : addXp > 600 ? ':star2:' : addXp > 300 ? ':star:':''}`, {embed: embed});
    return;

}

async function repStatus(message) {

    let { author, createdTimestamp } = message;
    let todayDate = Math.floor(createdTimestamp / 86400000);

    let repProfile = await database.getRepProfile(author.id);
    if (!repProfile) {
        await database.setUserReps(author.id, 3);
        repProfile = await database.getRepProfile(author.id);
    }
    
    if (repProfile.repsRemaining < 3) {
        let lastRepDate = Math.floor(repProfile.lastRepTimestamp / 86400000);
        if (lastRepDate < todayDate) {
            await database.setUserReps(author.id, 3);
        }
    }

    repProfile = await database.getRepProfile(author.id);

    let midnightUTC = Math.floor(86400000 * (todayDate + 1));
    let timeFromNow = functions.getDelta(midnightUTC - createdTimestamp, 'hours');
    let fromNowText = '';
    if (timeFromNow.hours) fromNowText += `${timeFromNow.hours}h `;
    if (timeFromNow.minutes) fromNowText += `${timeFromNow.minutes}m `;
    if (timeFromNow.seconds) fromNowText += `${timeFromNow.seconds}s `;
    
    return `You have **${repProfile.repsRemaining}** rep${repProfile.repsRemaining != 1 ? 's':''} remaining to give! ${repProfile.repsRemaining <= 0 ? `Your reps will be replenished in ${fromNowText.trim()}.`:``}`;

}

async function repboard(message, local) {

    let guild = await message.guild.fetchMembers();
    let reps = await database.getReps();
    if (local) {
        reps = reps.filter(rep => guild.members.get(rep.userID) && rep.rep > 0);
    } else {
        reps = reps.filter(rep => rep.rep > 0);
    }

    if (streaks.length < 1) {
        return `⚠ Nobody${local ? ' on this server ':' '}currently has any reps!`;
    }

    for (let i = 0; i < reps.length; i++) {
        let rep = reps[i]
        let user = Client.users.get(rep.userID);
        if (!user) user = await Client.fetchUser(rep.userID);
        let name = user ? user.username.replace(/([\`\*\~\_])/g, "\\$&") : rep.userID;
        reps[i] = {
            userID: rep.userID, name: name, rep: rep.rep
        }
    }

    let repString = reps.sort((a,b) => a.name.localeCompare(b.name)).sort((a,b) => b.rep - a.rep).map((data, i) => `${i+1}. **${data.name.replace(/([\(\)\`\*\~\_])/g, "\\$&")}** (${data.rep})`).join('\n');

    let descriptions = [];
    while (repString.length > 2048 || repString.split('\n').length > 25) {
        let currString = repString.slice(0, 2048);

        let lastIndex = 0;
        for (let i = 0; i < 25; i++) {
            let index = currString.indexOf('\n', lastIndex) + 1;
            if (index) lastIndex = index; else break;
        }
        currString = currString.slice(0, lastIndex);
        repString = repString.slice(lastIndex);

        descriptions.push(currString);
    } 
    descriptions.push(repString);

    let pages = descriptions.map((desc, i) => {
        return {
            content: undefined,
            options: {embed: {
                author: {
                    name: `${local ? guild.name : `Global`} Repboard`, icon_url: 'https://i.imgur.com/OQLFaj9.png'
                },
                description: desc,
                color: 0x44e389,
                footer: {
                    text: `Entries: ${reps.length}  |  Total Reps: ${reps.reduce((acc, curr) => acc + curr.rep, 0)}  |  Page ${i+1} of ${descriptions.length}`
                }
            }}
        }
    })

    functions.pages(message, pages);

}

async function streaks(message) {

    let { author, createdTimestamp } = message;

    await database.updateStreaks(createdTimestamp);
    let streaks = await database.getUserStreaks(author.id);

    if (streaks.length < 1) {
        return "⚠ You do not currently have any rep streaks!";
    }

    for (let i = 0; i < streaks.length; i++) {
        let streak = streaks[i]
        let userID = author.id == streak.user1 ? streak.user2 : streak.user1; 
        let user = Client.users.get(userID);
        if (!user) user = await Client.fetchUser(userID);
        let name = user ? user.username.replace(/([\`\*\~\_])/g, "\\$&") : userID;

        let time = functions.getDelta((Math.min(streak.user1LastRep || streak.firstRep, streak.user2LastRep || streak.firstRep) + 36*60*60*1000) - createdTimestamp, 'hours');
        let timeText = ''
        if (time.hours) timeText += `${time.hours}h `;
        if (time.minutes) timeText += `${time.minutes}m `;
        if (time.seconds) timeText += `${time.seconds}s `;

        let streakDays = Math.floor((createdTimestamp - streak.firstRep) / 86400000 /* 24 Hours */);

        streaks[i] = {
            userID: userID, name, streak: streakDays, time: time.ms, timeText
        }
    }

    let clocks = { 1: '\\🕐', 2:  '\\🕑', 3:  '\\🕒', 4: '\\🕓', 
                   5: '\\🕔', 6:  '\\🕕', 7:  '\\🕖', 8: '\\🕗',
                   9: '\\🕘', 10: '\\🕙', 11: '\\🕚', 0: '\\🕛' };
    let streakString = streaks.sort((a,b) => a.time - b.time).sort((a,b) => b.streak - a.streak).map((data, i) => `${i+1}. **${data.name.replace(/([\(\)\`\*\~\_])/g, "\\$&")}** - ${data.streak} Day${data.streak != 1 ? 's':''} (${data.timeText.trim()} left) ${data.time < 12*60*60*1000 ? clocks[Math.floor(data.time/(60*60*1000))]:``}`).join('\n');

    let descriptions = [];
    while (streakString.length > 2048 || streakString.split('\n').length > 25) {
        let currString = streakString.slice(0, 2048);

        let lastIndex = 0;
        for (let i = 0; i < 25; i++) {
            let index = currString.indexOf('\n', lastIndex) + 1;
            if (index) lastIndex = index; else break;
        }
        currString = currString.slice(0, lastIndex);
        streakString = streakString.slice(lastIndex);

        descriptions.push(currString);
    } 
    descriptions.push(streakString);

    let pages = descriptions.map((desc, i) => {
        return {
            content: undefined,
            options: {embed: {
                author: {
                    name: `${author.username}${author.username[author.username.length-1] == 's' ? "'":"'s"} Rep Streaks`, icon_url: 'https://i.imgur.com/WwdqYpS.png'
                },
                description: desc,
                color: 0xff473e,
                footer: {
                    text: `Page ${i+1} of ${descriptions.length}`
                }
            }}
        }
    })

    functions.pages(message, pages);

}

async function streakboard(message, local) {

    let { createdTimestamp } = message;
    let guild = await message.guild.fetchMembers();
    
    await database.updateStreaks(createdTimestamp);
    let streaks = await database.getAllStreaks();
    if (local) {
        streaks = streaks.filter(streak => guild.members.get(streak.user1) && guild.members.get(streak.user2) && createdTimestamp - streak.firstRep > 86400000 && streak.user1LastRep && streak.user2LastRep);
    } else {
        streaks = streaks.filter(streak => createdTimestamp - streak.firstRep > 86400000 && streak.user1LastRep && streak.user2LastRep);   
    }

    if (streaks.length < 1) {
        return `⚠ Nobody${local ? ' on this server ':' '}currently has any rep streaks!`;
    }

    for (let i = 0; i < streaks.length; i++) {
        let streak = streaks[i]
        let user1 = Client.users.get(streak.user1);
        let user2 = Client.users.get(streak.user2);
        if (!user1) user1 = await Client.fetchUser(streak.user1);
        if (!user2) user1 = await Client.fetchUser(streak.user2);
        let name1 = user1 ? user1.username.replace(/([\`\*\~\_])/g, "\\$&") : streak.user1;
        let name2 = user2 ? user2.username.replace(/([\`\*\~\_])/g, "\\$&") : streak.user2;

        let time = createdTimestamp - streak.firstRep;
        let streakDays = Math.floor(time / 86400000 /* 24 Hours */);

        streaks[i] = {
            user1: streak.user1, user2: streak.user2, name1, name2, streak: streakDays, time
        }
    }

    let streakString = streaks.sort((a,b) => b.time - a.time).map((data, i) => `${i+1}. **${data.name1.replace(/([\(\)\`\*\~\_])/g, "\\$&")}** & **${data.name2.replace(/([\(\)\`\*\~\_])/g, "\\$&")}** (${data.streak} Day${data.streak != 1 ? 's':''})`).join('\n');

    let descriptions = [];
    while (streakString.length > 2048 || streakString.split('\n').length > 25) {
        let currString = streakString.slice(0, 2048);

        let lastIndex = 0;
        for (let i = 0; i < 25; i++) {
            let index = currString.indexOf('\n', lastIndex) + 1;
            if (index) lastIndex = index; else break;
        }
        currString = currString.slice(0, lastIndex);
        streakString = streakString.slice(lastIndex);

        descriptions.push(currString);
    } 
    descriptions.push(streakString);

    let pages = descriptions.map((desc, i) => {
        return {
            content: undefined,
            options: {embed: {
                author: {
                    name: `${local ? guild.name : `Global`} Rep Streakboard`, icon_url: 'https://i.imgur.com/WwdqYpS.png'
                },
                description: desc,
                color: 0xff473e,
                footer: {
                    text: `Entries: ${streaks.length}  |  Avg. Streak: ${Math.round(streaks.reduce((acc, curr) => acc + curr.streak, 0) / streaks.length)}  |  Page ${i+1} of ${descriptions.length}`
                }
            }}
        }
    })

    functions.pages(message, pages);

}
