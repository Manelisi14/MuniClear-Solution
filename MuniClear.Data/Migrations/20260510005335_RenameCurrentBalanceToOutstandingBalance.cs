using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MuniClear.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameCurrentBalanceToOutstandingBalance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CurrentBalance",
                table: "Accounts",
                newName: "OutstandingBalance");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                table: "Residents",
                type: "TEXT",
                maxLength: 15,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Residents",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "OutstandingBalance",
                table: "Accounts",
                newName: "CurrentBalance");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                table: "Residents",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 15,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Residents",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);
        }
    }
}
