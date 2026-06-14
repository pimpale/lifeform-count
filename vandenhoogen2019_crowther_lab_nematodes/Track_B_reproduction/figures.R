# Reproduction of nematode_notebook_20190621.Rmd (Van den Hoogen & Geisen et al. 2019)
# Path-corrected, plain-R version. Faithful to original; changes:
#   - removed hardcoded setwd("~/Work/ETH/...") calls; outputs -> Track_B_reproduction/output
#   - each figure wrapped in tryCatch so one failure doesn't abort the run
#   - SKIPPED chunks whose data files are not in the repository:
#       * Fig 2b  (20180731_Nematode_BootStrap_StdError_1000Seeds.csv)
#       * Figs 2c-h Predicted vs Observed (six *_PredVsObs.csv)
#   - NMDS: saved NemaNMDS_31012019.rda is absent, so it is RECOMPUTED with metaMDS
.libPaths("~/R/libs")
suppressPackageStartupMessages({
  library(reshape2); library(tidyverse); library(cowplot); library(RColorBrewer)
  library(cluster); library(scales)
})
has <- function(p) requireNamespace(p, quietly = TRUE)

data_dir <- file.path("Nematode_Observations", "Data")
out_dir  <- file.path("Track_B_reproduction", "output")
rd <- function(f) read.csv(file.path(data_dir, f))
sect <- function(x) cat("\n========== ", x, " ==========\n")

# ---------------- Initial data formatting ----------------
Data_raw <- rd("20190131_NematodePoints_SampledPixelValues_wBiome.csv")
Data_raw <- tibble::rowid_to_column(Data_raw, "ID")
Antarctica_points <- rd("20193119_NematodePoints_Antarctica_SampledPixelValues.csv")
Antarctica <- Antarctica_points %>% select(-Unidentified, -Pixel_Lat, -Pixel_Long)

grp <- c('Total_Number','Bacterivores','Fungivores','Herbivores','Omnivores','Predators')
for (g in c('Bacterivores','Fungivores','Herbivores','Omnivores','Predators'))
  Data_raw[[paste0(g, ".pct")]] <- Data_raw[[g]] / rowSums(Data_raw[, grp])

Data_tot0 <- Data_raw[, c('ID', grp)] %>% na.omit() %>% filter(Total_Number != 0)
Data_group <- Data_tot0[, c('Bacterivores','Fungivores','Herbivores','Omnivores','Predators')] %>% na.omit()
Used_IDs <- Data_tot0[, 1, drop = FALSE]

GroupComposition <- Data_raw[, c('ID','Bacterivores.pct','Fungivores.pct','Herbivores.pct','Omnivores.pct','Predators.pct')]
GroupComposition <- merge(GroupComposition, Used_IDs, "ID")
GroupComposition <- subset(GroupComposition, select = -ID)
names(GroupComposition) <- c('Bacterivores','Fungivores','Herbivores','Omnivores','Predators')

# ---------------- Figure 1a - Sampling locations ----------------
tryCatch({
  sect("Figure 1a - sampling map")
  if (!has("maps")) { cat("SKIP: 'maps' package needed for map_data('world').\n") } else {
    total_points <- plyr::rbind.fill(Data_raw, Antarctica_points)
    world <- map_data("world")
    pal <- brewer.pal(8, "YlOrRd")
    p <- ggplot() +
      geom_polygon(data = world, aes(long, lat, group = group), fill = "#bababa", color = NA, linewidth = 0.1) +
      coord_fixed(1.1) +
      geom_point(data = total_points, aes(Pixel_Long, Pixel_Lat, fill = Total_Number), color = "black", pch = 21) +
      scale_fill_gradientn(colors = pal, limits = c(0, 3000), oob = scales::squish,
                           name = "Nematodes per 100g dry soil") +
      theme_minimal() +
      theme(legend.position = "bottom", panel.grid = element_blank(),
            axis.title = element_blank(), axis.text = element_blank())
    ggsave(file.path(out_dir, "Fig1a_nematode_pointmap.pdf"), p, width = 10, height = 6)
    cat("wrote Fig1a_nematode_pointmap.pdf (", nrow(total_points), "points)\n")
  }
}, error = function(e) cat("ERROR Fig1a:", conditionMessage(e), "\n"))

# ---------------- Figure 1b - abundance summary per biome ----------------
tryCatch({
  sect("Figure 1b - summary per biome (Data_biome_sum)")
  Data_biome <- Data_raw %>%
    select(all_of(grp), WWF_Biome) %>%
    plyr::rbind.fill(Antarctica) %>%
    filter(!WWF_Biome %in% c(2,3,9,98)) %>% na.omit() %>%
    melt(id.vars = "WWF_Biome")
  bmap <- c(`1`="Tropical Moist Forests",`4`="Temperate Broadleaf Forests",`5`="Temperate Conifer Forests",
            `6`="Boreal Forests",`7`="Tropical Grasslands",`8`="Temperate Grasslands",`10`="Montane Grasslands",
            `11`="Tundra",`12`="Mediterranean Forests",`13`="Deserts",`25`="Antarctica")
  Data_biome$WWF_Biome <- bmap[as.character(Data_biome$WWF_Biome)]
  names(Data_biome) <- c("Biome","Group","Count")
  Data_biome_sum <- Data_biome %>% filter(Group == "Total_Number") %>% group_by(Biome) %>%
    dplyr::summarize(Mean = mean(Count, na.rm = TRUE), Median = median(Count, na.rm = TRUE), n = n()) %>%
    arrange(desc(Median))
  print(as.data.frame(Data_biome_sum))
  write.csv(Data_biome_sum, file.path(out_dir, "Fig1b_data_biome_sum.csv"), row.names = FALSE)
}, error = function(e) cat("ERROR Fig1b:", conditionMessage(e), "\n"))

# ---------------- Figure 2a - standard error of observations ----------------
tryCatch({
  sect("Figure 2a - standard error vs sample size (observations)")
  std.error <- function(x) sd(x, na.rm = TRUE) / sqrt(sum(!is.na(x)))
  Dt <- Data_raw[, grp] %>% na.omit() %>% filter(Total_Number != 0) %>%
    dplyr::rename("Total number" = Total_Number)
  Dt <- stack(as.data.frame(Dt)) %>% dplyr::rename(Group = ind, Count = values) %>% group_by(Group)
  nsamples <- c(10,25,50,75,100,150,250,500)
  acc <- list()
  for (s in 1:100) {
    set.seed(s)
    per <- lapply(nsamples, function(i) {
      smp <- dplyr::sample_n(Dt, i, replace = TRUE)
      dplyr::summarise(group_by(smp, Group), se = std.error(Count), .groups = "drop") %>% mutate(nsamples = i)
    })
    acc[[s]] <- bind_rows(per)
  }
  out <- bind_rows(acc) %>% group_by(Group, nsamples) %>%
    dplyr::summarise(mean.se = mean(se), .groups = "drop")
  col_o <- colorRampPalette(c("#8399B2","#B26A4A","#B2A877","#62B25E","#40B29A","#ef7e6b"))
  p <- ggplot(out, aes(nsamples, mean.se, group = Group, color = factor(Group))) +
    geom_point() + geom_smooth(se = FALSE, method = "loess", formula = y ~ log(x)) +
    scale_color_manual(values = col_o(6), name = "Trophic group") +
    xlab("Sample size") + ylab("Standard error (nematodes per 100 g dry soil)") +
    scale_y_continuous(labels = comma)
  ggsave(file.path(out_dir, "Fig2a_stderr_observations.pdf"), p, width = 7, height = 5)
  cat("wrote Fig2a_stderr_observations.pdf\n")
}, error = function(e) cat("ERROR Fig2a:", conditionMessage(e), "\n"))

# ---------------- Figure 2b & 2c-h - SKIPPED (data not in repo) ----------------
sect("Figures 2b and 2c-h - SKIPPED")
cat("Fig 2b needs 20180731_Nematode_BootStrap_StdError_1000Seeds.csv (absent).\n")
cat("Figs 2c-h need six *_PredVsObs.csv files (absent).\n")

# ---------------- Extended Data Fig 6a - trophic group correlation ----------------
tryCatch({
  sect("Extended Data Fig 6a - trophic group correlation (Spearman)")
  NemaCor <- cor(Data_group, use = "pairwise.complete.obs", method = "spearman")
  print(round(NemaCor, 3))
  if (has("corrplot")) {
    col <- colorRampPalette(c('#330044','#220066','#1133cc','#33dd00','#ffda21','#ff6622','#d10000'))
    pdf(file.path(out_dir, "EDFig6a_correlation.pdf"))
    corrplot::corrplot(NemaCor, method = "circle", type = "upper", tl.col = "black",
                       tl.srt = 45, addgrid.col = NA, diag = FALSE, col = col(1000))
    dev.off()
    cat("wrote EDFig6a_correlation.pdf\n")
  } else cat("SKIP corrplot pdf: package missing\n")
}, error = function(e) cat("ERROR EDFig6a:", conditionMessage(e), "\n"))

# ---------------- Extended Data Fig 6b - PAM clustering / community types ----------------
tryCatch({
  sect("Extended Data Fig 6b - PAM clustering (k=4)")
  set.seed(123)
  pam.res <- pam(GroupComposition, 4)
  cluster_info <- tibble::rowid_to_column(as.data.frame(pam.res$cluster), "ID")
  names(cluster_info) <- c("ID","Cluster")
  cat("Cluster sizes:\n"); print(table(cluster_info$Cluster))
  GroupCompositionID <- tibble::rowid_to_column(GroupComposition, "ID")
  Nema <- merge(GroupCompositionID, cluster_info, by = "ID")
  Nema <- melt(Nema, id = c("ID","Cluster")); names(Nema) <- c("ID","Cluster","Group","Freq")
  col <- colorRampPalette(c("#e24646","#bb6cc9","#11c63f","#c68311","#1186c6"))
  p <- ggplot(Nema, aes(Freq, fill = Group)) + geom_density(alpha = 0.3) +
    theme_minimal() + xlab("Frequency") + ylab("") +
    scale_fill_manual(values = col(5), name = "Trophic group") + xlim(0, 0.5)
  p <- if (has("lemon")) p + lemon::facet_rep_wrap(~Cluster, repeat.tick.labels = TRUE) else p + facet_wrap(~Cluster)
  ggsave(file.path(out_dir, "EDFig6b_community_plots.pdf"), p, width = 6, height = 6)
  cat("wrote EDFig6b_community_plots.pdf\n")
  assign("cluster_info", cluster_info, envir = .GlobalEnv)
}, error = function(e) cat("ERROR EDFig6b:", conditionMessage(e), "\n"))

# ---------------- Extended Data Fig 6c - NMDS (recomputed) ----------------
tryCatch({
  sect("Extended Data Fig 6c - NMDS (recomputed via metaMDS)")
  if (!has("vegan")) { cat("SKIP: vegan not available\n") } else {
    set.seed(123)
    NemaNMDS <- vegan::metaMDS(comm = GroupComposition, distance = "bray", k = 3, pc = TRUE,
                               autotransform = FALSE, trymax = 100, center = TRUE, trace = 0)
    cat("NMDS stress:", round(NemaNMDS$stress, 4), "\n")
    envfactors <- merge(Used_IDs, Data_raw, by = "ID")
    envcols <- c('Annual_Precipitation','Aridity_Index','Sand_Content_15cm','OrgCStockTHa_5to15cm','NDVI',
                 'Annual_Mean_Temperature','Shannon_Index_1km','Precipitation_Seasonality',
                 'Temperature_Seasonality','pHinHOX_15cm','EVI','Human_Development_Percentage')
    envcols <- envcols[envcols %in% names(envfactors)]
    fit <- vegan::envfit(NemaNMDS, envfactors[, envcols], na.rm = TRUE, permutations = 999)
    cat("\nenvfit (R2 and p per covariate):\n"); print(fit)
    NMDS.df <- data.frame(NMDS1 = NemaNMDS$points[,1], NMDS2 = NemaNMDS$points[,2])
    NMDS.df$Cluster <- factor(get("cluster_info", .GlobalEnv)$Cluster)
    es <- as.data.frame(vegan::scores(fit, display = "vectors")); es$var <- rownames(es)
    p <- ggplot(NMDS.df, aes(NMDS1, NMDS2)) +
      geom_point(aes(color = Cluster, shape = Cluster), size = 0.6) + theme_minimal() +
      geom_segment(data = es, aes(x = 0, xend = 4*NMDS1, y = 0, yend = 4*NMDS2),
                   arrow = arrow(length = unit(0.25,"cm")), colour = "black", inherit.aes = FALSE) +
      geom_text(data = es, aes(4.5*NMDS1, 4.5*NMDS2, label = var), size = 3, inherit.aes = FALSE) +
      annotate("text", x = -0.9, y = 1.5, size = 3,
               label = paste("Stress =", format(round(NemaNMDS$stress, 4), nsmall = 4)))
    ggsave(file.path(out_dir, "EDFig6c_NMDS.pdf"), p, width = 7, height = 7)
    cat("wrote EDFig6c_NMDS.pdf\n")
  }
}, error = function(e) cat("ERROR EDFig6c:", conditionMessage(e), "\n"))

sect("DONE")
cat("Outputs in", out_dir, "\n"); print(list.files(out_dir))
