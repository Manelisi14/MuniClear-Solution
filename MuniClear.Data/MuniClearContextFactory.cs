using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MuniClear.Data
{
    public class MuniDbContextFactory : IDesignTimeDbContextFactory<MuniClearContext>
    {
        public MuniClearContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<MuniClearContext>();

            // This matches your muni.db file exactly
            optionsBuilder.UseSqlite("Data Source=muni.db");

            return new MuniClearContext(optionsBuilder.Options);
        }
    }
}
