# Reproduction of RMD_biomass_carbon_20190621.Rmd (Van den Hoogen & Geisen et al. 2019)
# Path-corrected, plain-R version. Faithful to original logic; only changes:
#   - removed hardcoded setwd("~/Work/ETH/...") calls
#   - data read from repo Data/ dir; filename "Family Ecophysiology qParameters.csv"
#     corrected to repo name "Family_Ecophysiology_qParameters.csv"
#   - deprecated funs() replaced with list(~ ...) (defunct in modern dplyr)
#   - write.csv outputs redirected to Track_B_reproduction/output/
.libPaths("~/R/libs")
suppressPackageStartupMessages(library(tidyverse))

data_dir <- file.path("Nematode_Observations", "Data")
out_dir  <- file.path("Track_B_reproduction", "output")
rd <- function(f) read.csv(file.path(data_dir, f), stringsAsFactors = FALSE)

# --- Initial values and assumptions ---
cperw = 0.2 * 0.52
a.O2 = 1.4
V.CO2 = 0.95 * a.O2
t = 15
m = V.CO2 / (0.0821 * (273 + t) * 1E9)
a.CO2 = m * (44 * 1E9)
a.CO2.daily = a.CO2 * 24 * (12/44) / 1000

# --- Data import ---
Nemaplex_data_raw <- read.csv(file.path(data_dir, "Family_Ecophysiology_qParameters.csv"),
                              stringsAsFactors = FALSE, fileEncoding = "latin1")
mulder_2011 <- rd("Mulder2011.csv")
mulder_data <- mulder_2011 %>% select(trophic.group, Length, Width, Juv_Adult)
Biome_Abundances <- rd("20180827_Biome_Abundances.csv")
numbers_min <- rd("20180912_Biome_Abundances_Minimum.csv") %>%
  select(-Total_Number) %>% gather(key, value, -Biome) %>%
  rename(trophic.group = key) %>% rename(Total.number = value)
numbers_max <- rd("20180912_Biome_Abundances_Maximum.csv") %>%
  select(-Total_Number) %>% gather(key, value, -Biome) %>%
  rename(trophic.group = key) %>% rename(Total.number = value)

adult_data_1 <- Nemaplex_data_raw %>%
  select(cp.value, feeding.code, Length.micm, Width.micm) %>%
  mutate(feeding.code = replace(feeding.code, feeding.code == "p", "Predators")) %>%
  mutate(feeding.code = replace(feeding.code, feeding.code == "o", "Omnivores")) %>%
  mutate(feeding.code = replace(feeding.code, feeding.code == "b", "Bacterivores")) %>%
  mutate(feeding.code = replace(feeding.code, feeding.code == "h", "Herbivores")) %>%
  mutate(feeding.code = replace(feeding.code, feeding.code == "f", "Fungivores")) %>%
  filter(feeding.code != "e") %>% filter(feeding.code != "d") %>% filter(feeding.code != "") %>%
  rename(trophic.group = feeding.code) %>% rename(Length = Length.micm) %>% rename(Width = Width.micm)

cp.values <- adult_data_1 %>% group_by(trophic.group) %>% summarise(cp.value = mean(cp.value))

mulder_data$trophic.group <- substr(mulder_data$trophic.group, 1, 4)
adult_data_2 <- mulder_data %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "bact", "Bacterivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "fung", "Fungivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "herb", "Herbivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "omni", "Omnivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "pred", "Predators")) %>%
  filter(Juv_Adult == "adult")
adult_data_2 <- adult_data_2 %>% select(-Juv_Adult)
adult_data_2 <- merge(cp.values, adult_data_2[1:3], by = "trophic.group")
adult_data <- rbind(adult_data_1, adult_data_2)

# --- Bodymass calculations: Adults ---
adult_data$mass <- with(adult_data, (Length * Width * Width)/(1.6*1E6))
adult_data$Respiration.rate <- with(adult_data, (a.CO2.daily * ((adult_data$mass)^0.75)))
adult_data$Production.rate <- with(adult_data, (cperw * ((adult_data$mass)/(12 * adult_data$cp.value))))
adult_data$Carbon.budget <- with(adult_data, (adult_data$Respiration.rate + adult_data$Production.rate))
summary_adult <- adult_data %>% group_by(trophic.group) %>%
  summarise(n.measurements = n(), mean.mass.ug = mean(mass),
            mean.daily.respiration.rate.ug = mean(Respiration.rate),
            mean.daily.production.rate.ug = mean(Production.rate),
            mean.daily.carbon.budget.ug = mean(Carbon.budget)) %>% na.omit()
cat("\n===== summary_adult =====\n"); print(as.data.frame(summary_adult))

# --- Juveniles ---
juv_data <- mulder_2011 %>% select(Taxonomy, trophic.group, Length, Width, Juv_Adult)
juv_data$trophic.group <- substr(juv_data$trophic.group, 1, 4)
juv_data <- juv_data %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "bact", "Bacterivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "fung", "Fungivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "herb", "Herbivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "omni", "Omnivores")) %>%
  mutate(trophic.group = replace(trophic.group, trophic.group == "pred", "Predators")) %>%
  filter(Juv_Adult == "juveniles")
cp.values <- adult_data %>% group_by(trophic.group) %>% summarise(cp.value = mean(cp.value))
juv_data <- merge(cp.values, juv_data[1:5], by = "trophic.group")
juv_data$Mass <- with(juv_data, (Length * Width * Width)/(1.6*1E6))
juv_data$Respiration.rate <- with(juv_data, (a.CO2.daily * ((juv_data$Mass)^0.75)))
juv_data$Production.rate <- with(juv_data, (cperw * ((juv_data$Mass)/(12 * juv_data$cp.value))))
juv_data$Carbon.budget <- with(juv_data, (juv_data$Respiration.rate + juv_data$Production.rate))
summary_juv <- juv_data %>% group_by(trophic.group) %>%
  summarise(n.measurements = n(), mean.mass.ug = mean(Mass),
            mean.daily.respiration.rate.ug = mean(Respiration.rate),
            mean.daily.production.rate.ug = mean(Production.rate),
            mean.daily.carbon.budget.ug = mean(Carbon.budget)) %>% na.omit()
cat("\n===== summary_juv =====\n"); print(as.data.frame(summary_juv))

# --- Number of nematodes per biome ---
numbers <- Biome_Abundances %>% select(-Total_Number) %>% gather(key, value, -Biome) %>%
  rename(trophic.group = key) %>% rename(Total.number = value)
numbers_tot <- numbers %>% group_by(trophic.group) %>% summarise(tot.numb.indiv = sum(Total.number))
numbers_biome <- numbers %>% group_by(trophic.group, Biome) %>% summarise(tot.numb.indiv = sum(Total.number), .groups = "drop")

total_fn <- list(~ if (is.numeric(.)) sum(.) else "Total")
numbers_tot_print <- numbers_tot %>%
  rename("Trophic group" = 1) %>% rename("Number of individuals" = 2) %>%
  bind_rows(summarise_all(., total_fn))
cat("\n===== Total individuals per trophic group =====\n"); print(as.data.frame(numbers_tot_print))

# --- Carbon budget: Adults ---
summary_tot_adult <- merge(summary_adult, numbers_tot, by = "trophic.group")
summary_tot_adult$total.biomass.Gt <- with(summary_tot_adult, (mean.mass.ug * tot.numb.indiv)/1E21)
summary_tot_adult$total.Cbiomass.Gt <- with(summary_tot_adult, (total.biomass.Gt * cperw))
summary_tot_adult$total.mon.resp.Gt <- with(summary_tot_adult, (mean.daily.respiration.rate.ug * tot.numb.indiv * 31)/1E21)
summary_tot_adult$total.mon.prod.Gt <- with(summary_tot_adult, (mean.daily.production.rate.ug * tot.numb.indiv * 31)/1E21)
summary_tot_adult$total.C.budget.Gt <- with(summary_tot_adult, (total.mon.prod.Gt + total.mon.resp.Gt))
summary_tot_adult <- summary_tot_adult %>%
  select(trophic.group, tot.numb.indiv, total.biomass.Gt, total.Cbiomass.Gt, total.mon.resp.Gt, total.mon.prod.Gt, total.C.budget.Gt) %>%
  rename("Trophic group" = 1) %>% rename("Computed individuals" = 2) %>%
  rename("Fresh biomass (Mt)" = 3) %>% rename("Biomass (Mt C)" = 4) %>%
  rename("Monthly respiration (Mt C)" = 5) %>% rename("Monthly production (Mt C)" = 6) %>%
  rename("Monthly carbon budget (Mt C)" = 7) %>%
  bind_rows(summarise_all(., total_fn))
summary_tot_adult[,3:7] <- summary_tot_adult[,3:7] * 1000
summary_tot_adult[,-1] <- round(select_if(summary_tot_adult, is.numeric), 2)
summary_tot_adult[,2] <- formatC(summary_tot_adult[,2], format = "e", digits = 2)
cat("\n===== Carbon budget: ADULTS (Mt C) =====\n"); print(as.data.frame(summary_tot_adult))

# --- Carbon budget: Juveniles ---
summary_tot_juv <- merge(summary_juv, numbers_tot, by = "trophic.group")
summary_tot_juv$total.biomass.Gt <- with(summary_tot_juv, (mean.mass.ug * tot.numb.indiv)/1E21)
summary_tot_juv$total.Cbiomass.Gt <- with(summary_tot_juv, (total.biomass.Gt * cperw))
summary_tot_juv$total.mon.resp.Gt <- with(summary_tot_juv, (mean.daily.respiration.rate.ug * tot.numb.indiv * 31)/1E21)
summary_tot_juv$total.mon.prod.Gt <- with(summary_tot_juv, (mean.daily.production.rate.ug * tot.numb.indiv * 31)/1E21)
summary_tot_juv$total.C.budget.Gt <- with(summary_tot_juv, (total.mon.prod.Gt + total.mon.resp.Gt))
summary_tot_juv <- summary_tot_juv %>%
  select(trophic.group, tot.numb.indiv, total.biomass.Gt, total.Cbiomass.Gt, total.mon.resp.Gt, total.mon.prod.Gt, total.C.budget.Gt) %>%
  rename("Trophic group" = 1) %>% rename("Computed individuals" = 2) %>%
  rename("Fresh biomass (Mt)" = 3) %>% rename("Biomass (Mt C)" = 4) %>%
  rename("Monthly respiration (Mt C)" = 5) %>% rename("Monthly production (Mt C)" = 6) %>%
  rename("Carbon budget (Mt C)" = 7) %>%
  bind_rows(summarise_all(., total_fn))
summary_tot_juv[,3:7] <- summary_tot_juv[,3:7] * 1000
summary_tot_juv[,-1] <- round(select_if(summary_tot_juv, is.numeric), 2)
summary_tot_juv[,2] <- formatC(summary_tot_juv[,2], format = "e", digits = 2)
cat("\n===== Carbon budget: JUVENILES (Mt C) =====\n"); print(as.data.frame(summary_tot_juv))

# --- Total carbon budget (30% adults, 70% juveniles) ---
adult_frac <- 0.30; juv_frac <- 0.70
summary_tot_final <- summary_tot_juv[,1:2]
summary_tot_final[3:7] <- ((adult_frac * summary_tot_adult[3:7]) + (juv_frac * summary_tot_juv[3:7]))
summary_tot_final[3:7] <- round(select_if(summary_tot_final[3:7], is.numeric), 2)
cat("\n===== TOTAL carbon budget (Table 1; Mt C) =====\n"); print(as.data.frame(summary_tot_final))
write.csv(summary_tot_final, file.path(out_dir, "Table1_carbon_budget.csv"), row.names = FALSE)

# --- Relative abundances per biome (Table S5/S6) ---
abundances <- Biome_Abundances
rel.abundance.trophic <- format(round(prop.table(data.frame(as.list(apply(subset(abundances, select = c(-Biome, -Total_Number)), 2, sum)))), 3), nsmall = 3)
cat("\n===== Relative abundance per trophic group =====\n"); print(rel.abundance.trophic)

# --- Biomass per biome ---
summary_biome_adult <- merge(summary_adult, numbers_biome, by = "trophic.group")
summary_biome_adult$total.biomass.Gt <- with(summary_biome_adult, (mean.mass.ug * tot.numb.indiv)/1E21)
summary_biome_adult$total.biomass.C.Gt <- with(summary_biome_adult, (total.biomass.Gt * cperw * 1000))
biomesum_adult <- summary_biome_adult %>% group_by(Biome, trophic.group) %>%
  summarise(v = sum(total.biomass.C.Gt), .groups = "drop") %>% spread(key = trophic.group, value = v)
biomesum_adult <- transform(biomesum_adult, Total.biomass = rowSums(subset(biomesum_adult, select = -Biome)))

summary_biome_juv <- merge(summary_juv, numbers_biome, by = "trophic.group")
summary_biome_juv$total.biomass.Gt <- with(summary_biome_juv, (mean.mass.ug * tot.numb.indiv)/1E21)
summary_biome_juv$total.biomass.C.Gt <- with(summary_biome_juv, (total.biomass.Gt * cperw * 1000))
biomesum_juv <- summary_biome_juv %>% group_by(Biome, trophic.group) %>%
  summarise(v = sum(total.biomass.C.Gt), .groups = "drop") %>% spread(key = trophic.group, value = v)
biomesum_juv <- transform(biomesum_juv, Total.biomass = rowSums(subset(biomesum_juv, select = -Biome)))

biomesum <- biomesum_adult[,1, drop = FALSE]
biomesum[2:7] <- ((adult_frac * biomesum_adult[2:7]) + (juv_frac * biomesum_juv[2:7]))
biome_names <- c(`1`="Tropical Moist Forests",`2`="Tropical Dry Forest",`3`="Tropical Coniferous Forests",
  `4`="Temperate Broadleaf Forests",`5`="Temperate Conifer Forests",`6`="Boreal Forests",
  `7`="Tropical Grasslands",`8`="Temperate Grasslands",`9`="Flooded Grasslands",`10`="Montane Grasslands",
  `11`="Tundra",`12`="Mediterranean Forests",`13`="Deserts",`14`="Mangroves")
biomesum$Biome <- ifelse(as.character(biomesum$Biome) %in% names(biome_names),
                         biome_names[as.character(biomesum$Biome)], as.character(biomesum$Biome))
biomesum_print <- biomesum %>% bind_rows(summarise_all(., total_fn))
cat("\n===== Biomass per biome (Mt C) =====\n"); print(as.data.frame(biomesum_print))
write.csv(biomesum_print, file.path(out_dir, "TableS7_biomass.csv"), row.names = FALSE)

# --- Total fresh biomass headline & human comparison ---
tot_fresh_biomass_Mt <- summary_tot_final$`Fresh biomass (Mt)`[6]
human_pop <- 7383008.82 * 1000
cat("\n===== Headline numbers =====\n")
cat("Total computed individuals (all groups):",
    format(numbers_tot_print$`Number of individuals`[6], scientific = TRUE, digits = 3), "\n")
cat("For each human on Earth,",
    format(round((numbers_tot_print$`Number of individuals`[6]/human_pop)/1E9, 1), nsmall = 1),
    "billion nematodes are present.\n")
cat("Total fresh nematode biomass (Mt):", round(tot_fresh_biomass_Mt, 1), "\n")
human_weight <- 50
human_biomass <- (human_pop * human_weight)/1E12
cat("Soil nematode fresh biomass represents",
    format(round((tot_fresh_biomass_Mt/1000 / human_biomass * 100), 1)),
    "% of total human biomass\n")
