use lyon_algorithms::{
    measure::{PathMeasurements, SampleType},
};
use lyon_path::Path;
use serde::{Deserialize, Serialize};

trait Integration {
    fn eval(&mut self, x: f64, y: f64, dx: f64, dy: f64) -> f64;
}

fn integrate_over<I: Integration>(mut f: I, p: &Path, eps: f32) -> f64 {
    let measurement = PathMeasurements::from_path(p, eps);
    let mut sampler = measurement.create_sampler(p, SampleType::Distance);
    let total_dist = sampler.length();
    // Start sampling
    let mut cur = 0f32;
    let mut int = 0f64;

    while cur < total_dist {
        let step = eps.min(total_dist - cur);
        // Sample at midpoint
        let mid = sampler.sample(cur + step / 2.0);

        let x = mid.position().x;
        let y = mid.position().y;
        let dx = mid.tangent().x * step;
        let dy = mid.tangent().y * step;
        int += f.eval(x as f64, y as f64, dx as f64, dy as f64);

        cur += step;
    }

    int
}

struct AreaIntegration;
struct A2ExIntegration;
struct NA2EyIntegration;
struct A3Ex2Integration;
struct NA3Ey2Integration;
struct A4ExyIntegration;

impl Integration for AreaIntegration {
    fn eval(&mut self, x: f64, _y: f64, _dx: f64, dy: f64) -> f64 { x * dy }
}

impl Integration for A2ExIntegration {
    fn eval(&mut self, x: f64, _y: f64, _dx: f64, dy: f64) -> f64 { x * x * dy }
}

impl Integration for NA2EyIntegration {
    fn eval(&mut self, _x: f64, y: f64, dx: f64, _dy: f64) -> f64 { y * y * dx }
}

impl Integration for A3Ex2Integration {
    fn eval(&mut self, x: f64, _y: f64, _dx: f64, dy: f64) -> f64 { x * x * x * dy }
}

impl Integration for NA3Ey2Integration {
    fn eval(&mut self, _x: f64, y: f64, dx: f64, _dy: f64) -> f64 { y * y * y * dx }
}

impl Integration for A4ExyIntegration {
    fn eval(&mut self, x: f64, y: f64, dx: f64, dy: f64) -> f64 { x * x * y * dy - x * y * y * dx }
}

struct CovMat {
    e_x: f64,
    e_y: f64,
    var_x: f64,
    var_y: f64,
    cov_xy: f64,
}

fn compute_covmat(p: &Path, eps: f32) -> CovMat {
    let area = integrate_over(AreaIntegration, p, eps);
    let ex = integrate_over(A2ExIntegration, p, eps) / area / 2f64;
    let ey = -integrate_over(NA2EyIntegration, p, eps) / area / 2f64;
    let ex2 = integrate_over(A3Ex2Integration, p, eps) / area / 3f64;
    let ey2 = -integrate_over(NA3Ey2Integration, p, eps) / area / 3f64;
    let exy = integrate_over(A4ExyIntegration, p, eps) / area / 4f64;
    
    let var_x = ex2 - ex * ex;
    let var_y = ey2 - ey * ey;
    let cov_xy = exy - ex * ey;

    CovMat {
        e_x: ex,
        e_y: ey,
        var_x,
        var_y,
        cov_xy,
    }
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ts_rs::TS)]
pub struct Direction {
    origin: (f64, f64),
    vector: (f64, f64),
}

pub fn compute_direction(p: &Path, eps: f64) -> Direction {
    let cov = compute_covmat(p, eps as f32);
    let det = cov.var_x * cov.var_y - cov.cov_xy * cov.cov_xy;

    let mean_trace = (cov.var_x + cov.var_y) / 2.0;
    assert!(mean_trace * mean_trace >= det);
    let larger_ev = mean_trace + (mean_trace * mean_trace - det).sqrt();

    if larger_ev < eps {
        return Direction {
            origin: (cov.e_x, cov.e_y),
            vector: (0.0, 0.0),
        };
    }

    let eigenvector_x = cov.cov_xy;
    let eigenvector_y = larger_ev - cov.var_x;

    let eigenvector_len = (eigenvector_x * eigenvector_x + eigenvector_y * eigenvector_y).sqrt();
    let wanted_len = larger_ev.sqrt();

    let vector = (
        eigenvector_x / eigenvector_len * wanted_len,
        eigenvector_y / eigenvector_len * wanted_len,
    );
    Direction {
        origin: (cov.e_x, cov.e_y),
        vector,
    }
}
