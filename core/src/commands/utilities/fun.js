const { SlashCommandBuilder } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');

const NINTENDO_CHARACTERS = [
    'Mario',
    'Luigi',
    'Peach',
    'Bowser',
    'Yoshi',
    'Kirby',
    'Meta Knight',
    'King Dedede',
    'Pikachu',
    'Charizard',
    'Bulbasaur',
    'Squirtle',
    'Eevee',
    'Mewtwo',
    'Link',
    'Zelda',
    'Ganondorf',
    'Samus',
    'Fox McCloud',
    'Captain Falcon',
    'Donkey Kong',
    'Wario',
    'Rosalina',
    'Jigglypuff'
];

function buildFunEmbed(title, description, fields = [], color = 0xffa500) {
    return buildResponseEmbed({
        title,
        description,
        fields,
        color
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fun')
        .setDescription('Comandi divertenti e mini-giochi')
        .addSubcommand(sub => sub.setName('coinflip').setDescription('Lancia una moneta con scelta tra testa e croce').addStringOption(option => option.setName('scelta').setDescription('La tua scelta').setRequired(true).addChoices({ name: 'Testa', value: 'testa' }, { name: 'Croce', value: 'croce' })))
        .addSubcommand(sub => sub.setName('randomfact').setDescription('Mostra un fatto casuale'))
        .addSubcommand(sub => sub.setName('rps').setDescription('Carta sasso forbici contro il bot').addStringOption(option => option.setName('scelta').setDescription('La tua scelta').setRequired(true).addChoices({ name: 'Sasso', value: 'sasso' }, { name: 'Carta', value: 'carta' }, { name: 'Forbici', value: 'forbici' }))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'randomfact') {
            await interaction.deferReply();

            try {
                const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=it');
                if (!response.ok) {
                    throw new Error(`API response ${response.status}`);
                }

                const data = await response.json();
                await interaction.editReply({
                    embeds: [buildFunEmbed('Random Fact', data.text || 'Nessun fatto disponibile al momento.')]
                });
            } catch {
                await interaction.editReply({
                    embeds: [buildFunEmbed('Random Fact', '❌ Non riesco a recuperare un fatto casuale in questo momento.')]
                });
            }
            return;
        }

        if (subcommand === 'coinflip') {
            const userChoice = interaction.options.getString('scelta', true);
            const botChoice = Math.random() < 0.5 ? 'testa' : 'croce';
            const win = userChoice === botChoice;

            await interaction.reply({
                embeds: [buildFunEmbed(
                    'Coin Flip',
                    win
                        ? `Hai vinto. Hai scelto **${userChoice}** e la moneta è uscita **${botChoice}**.`
                        : `Hai perso. Hai scelto **${userChoice}** e la moneta è uscita **${botChoice}**.`
                )]
            });
            return;
        }

        if (subcommand === 'rps') {
            const choices = { sasso: 0, carta: 1, forbici: 2 };
            const userChoice = interaction.options.getString('scelta', true);
            const botChoice = Object.keys(choices)[Math.floor(Math.random() * 3)];

            const winner = (3 + choices[userChoice] - choices[botChoice]) % 3;
            await interaction.reply({
                embeds: [buildFunEmbed(
                    'Rock Paper Scissors',
                    winner === 0
                        ? `Pareggio. Hai scelto **${userChoice}** e io **${botChoice}**.`
                        : winner === 1
                            ? `Hai vinto. Hai scelto **${userChoice}** e io **${botChoice}**.`
                            : `Hai perso. Hai scelto **${userChoice}** e io **${botChoice}**.`
                )]
            });
        }
    }
};
