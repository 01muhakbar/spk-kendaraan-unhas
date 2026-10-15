'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('master_vehicles', 'model', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('master_vehicles', 'warna', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('master_vehicles', 'isi_silinder', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('master_vehicles', 'no_rangka', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('master_vehicles', 'no_mesin', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('master_vehicles', 'no_mesin');
    await queryInterface.removeColumn('master_vehicles', 'no_rangka');
    await queryInterface.removeColumn('master_vehicles', 'isi_silinder');
    await queryInterface.removeColumn('master_vehicles', 'warna');
    await queryInterface.removeColumn('master_vehicles', 'model');
  }
};
