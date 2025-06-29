use lyon_algorithms::{
    measure::{PathMeasurements, SampleType},
};
use lyon_path::Path;

trait Integration {
    fn eval(&mut self, x: f32, y: f32, dx: f32, dy: f32) -> f32;
}

fn integrate_over<I: Integration>(mut f: I, p: &Path, eps: f32) -> f32 {
    let measurement = PathMeasurements::from_path(p, eps);
    let mut sampler = measurement.create_sampler(p, SampleType::Distance);
    let total_dist = sampler.length();
    // Start sampling
    let mut cur = 0f32;
    let mut int = 0f32;

    while cur < total_dist {
        let step = eps.min(total_dist - cur);
        // Sample at midpoint
        let mid = sampler.sample(cur + step / 2.0);

        let x = mid.position().x;
        let y = mid.position().y;
        let dx = mid.tangent().x * step;
        let dy = mid.tangent().y * step;
        int += f.eval(x as f32, y as f32, dx as f32, dy as f32);

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
    fn eval(&mut self, x: f32, _y: f32, _dx: f32, dy: f32) -> f32 { x * dy }
}

impl Integration for A2ExIntegration {
    fn eval(&mut self, x: f32, _y: f32, _dx: f32, dy: f32) -> f32 { x * x * dy }
}

impl Integration for NA2EyIntegration {
    fn eval(&mut self, _x: f32, y: f32, dx: f32, _dy: f32) -> f32 { y * y * dx }
}

impl Integration for A3Ex2Integration {
    fn eval(&mut self, x: f32, _y: f32, _dx: f32, dy: f32) -> f32 { x * x * x * dy }
}

impl Integration for NA3Ey2Integration {
    fn eval(&mut self, _x: f32, y: f32, dx: f32, _dy: f32) -> f32 { y * y * y * dx }
}

impl Integration for A4ExyIntegration {
    fn eval(&mut self, x: f32, y: f32, dx: f32, dy: f32) -> f32 { x * x * y * dy - x * y * y * dx }
}

struct CovMat {
    var_x: f32,
    var_y: f32,
    cov_xy: f32,
}

fn compute_covmat(p: &Path, eps: f32) -> CovMat {
    let area = integrate_over(AreaIntegration, p, eps);
    let ex = integrate_over(A2ExIntegration, p, eps) / area / 2f32;
    let ey = -integrate_over(NA2EyIntegration, p, eps) / area / 2f32;
    let ex2 = integrate_over(A3Ex2Integration, p, eps) / area / 3f32;
    let ey2 = -integrate_over(NA3Ey2Integration, p, eps) / area / 3f32;
    let exy = integrate_over(A4ExyIntegration, p, eps) / area / 4f32;
    
    let var_x = ex2 - ex * ex;
    let var_y = ey2 - ey * ey;
    let cov_xy = exy - ex * ey;

    CovMat {
        var_x,
        var_y,
        cov_xy,
    }
}

pub fn compute_direction(p: &Path, eps: f32) -> (f32, f32) {
    let cov = compute_covmat(p, eps as f32);
    let det = cov.var_x * cov.var_y - cov.cov_xy * cov.cov_xy;

    let mean_trace = (cov.var_x + cov.var_y) / 2.0;
    assert!(mean_trace * mean_trace >= det);
    let larger_ev = mean_trace + (mean_trace * mean_trace - det).sqrt();
    let shorter_ev = mean_trace - (mean_trace * mean_trace - det).sqrt();

    if larger_ev < eps {
        return (0.0, 0.0);
    }

    let eigenvector_x = cov.cov_xy;
    let eigenvector_y = larger_ev - cov.var_x;

    let eigenvector_len = (eigenvector_x * eigenvector_x + eigenvector_y * eigenvector_y).sqrt();
    let wanted_len = 1f32 - (shorter_ev / larger_ev).abs().sqrt();

    let vector = (
        eigenvector_x / eigenvector_len * wanted_len,
        eigenvector_y / eigenvector_len * wanted_len,
    );

    vector
}
